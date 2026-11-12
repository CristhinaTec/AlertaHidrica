# 00_datos: base analítica centralizada

`centralizar.py` lee los datos crudos que dejó el recolector (`03_datos/externos/`) y los carga en
**DuckDB** (`03_datos/alertahidrica.duckdb`) y en **Parquet** (`03_datos/procesados/<tabla>.parquet`).
No descarga nada. Es idempotente: borra la base y los Parquet y los vuelve a crear.

## Cómo correrlo

```bash
pip install duckdb pandera pyarrow pandas
python 04_desarrollo/analisis/00_datos/centralizar.py      # desde la raíz del proyecto
```

Imprime los conteos por tabla y el catálogo. Si una validación Pandera falla, imprime el error,
sigue con el resto y lo deja en `catalogo_fuentes.estado`.

## Modelo de datos

| Tabla | Grano | Origen |
|---|---|---|
| `lecturas` | 1 valor por fecha × lugar × variable × fuente × miembro × emisión | open_meteo/*.csv, glofas/*.csv, noaa/*.csv, crudos/<fecha>/*.json |
| `localidades` | 1 fila por localidad EPS Grau | `config.LOCALIDADES` + ubigeo por cruce de nombre con CENEPRED |
| `distritos_riesgo` | 1 fila por distrito (ubigeo) | CENEPRED ER_NINO2027_BD_4 (inundación) + BD_5 (movimientos en masa, columnas con sufijo `_mm`) |
| `infraestructura_osm` | 1 elemento OSM | osm/piura_infraestructura.json |
| `cenepred_coen` | 1 objeto por capa COEN (tabla larga) | cenepred/COEN_FEN_2027_*.geojson |
| `catalogo_fuentes` | 1 fila por fuente/tabla | generado: filas, fecha_min/max, método, licencia, estado de validación |
| `inventario_recolector` | copia de `inventario.json` | recolector |

### `lecturas` (formato largo)
| columna | tipo | notas |
|---|---|---|
| fecha | DATE | día del dato (Niño semanal: inicio de semana; ONI: día 1 del mes central de la temporada) |
| id_lugar | VARCHAR | `GRAU-xx`, `rio_piura`, `rio_chira`, `nino12`, `nino3`, `nino34`, `nino4` |
| variable | VARCHAR | `lluvia`, `tmax`, `caudal`, `sst`, `sst_anom`, `oni_sst`, `oni_anom` |
| valor | DOUBLE | puede ser NULL (GloFAS sin dato) |
| unidad | VARCHAR | mm, °C, m3/s |
| fuente | VARCHAR | `open_meteo_era5`, `glofas_reanalisis`, `noaa_cpc_semanal`, `noaa_cpc_oni`, `open_meteo_ensemble`, `glofas_pronostico` |
| tipo | VARCHAR | `observado` / `reanalisis` / `pronostico` |
| miembro | SMALLINT | NULL fuera de pronóstico; 0 = control/media, 1..50 miembros |
| fecha_emision | DATE | carpeta `crudos/<fecha>`; NULL fuera de pronóstico |

`localidades`: id_lugar, nombre, lat, lon, rio, ubigeo, provincia.
`infraestructura_osm`: id (`node/123`), tipo_elemento, tipo (`man_made=water_tower`...), nombre, operador, lat, lon, tags (JSON).
`cenepred_coen`: capa, fid, geom_tipo, lat, lon (centroide aproximado = media de vértices), ubigeo, propiedades (JSON).
`distritos_riesgo`: todos los atributos CENEPRED + `lat_c`, `lon_c` (centroide aproximado). Sin geometría.

## Validaciones (Pandera)
- Claves no nulas; `tipo` en el dominio; `miembro` 0..51; sin duplicados de clave.
- lluvia 0–500 mm; caudal ≥ 0; anomalías (`*_anom`) −5..10 °C.
- lecturas se valida **por fuente**; localidades dentro de Piura; ubigeo de 6 dígitos y único; ids OSM únicos.

## Consultas de ejemplo

```python
import duckdb
con = duckdb.connect("03_datos/alertahidrica.duckdb", read_only=True)
con.sql("SELECT * FROM catalogo_fuentes").show()
```

```sql
-- Probabilidad de lluvia >= 20 mm por día (ensemble, última emisión)
SELECT id_lugar, fecha, avg((valor >= 20)::INT) AS p_20mm
FROM lecturas
WHERE tipo='pronostico' AND variable='lluvia' AND miembro > 0
  AND fecha_emision = (SELECT max(fecha_emision) FROM lecturas WHERE tipo='pronostico')
GROUP BY ALL ORDER BY id_lugar, fecha;

-- Picos anuales de caudal del río Piura (1998, 2017 ...)
SELECT year(fecha) AS anio, max(valor) AS pico_m3s
FROM lecturas WHERE id_lugar='rio_piura' AND fuente='glofas_reanalisis'
GROUP BY 1 ORDER BY 2 DESC LIMIT 5;

-- Localidades con su riesgo CENEPRED
SELECT l.id_lugar, l.nombre, d.pob_2017, d.niv_sinu, d.nriesgo_in, d.nriesgo_mm_mm
FROM localidades l LEFT JOIN distritos_riesgo d USING (ubigeo);

-- Infraestructura de EPS Grau en OSM
SELECT tipo, count(*) FROM infraestructura_osm
WHERE operador ILIKE '%grau%' GROUP BY 1 ORDER BY 2 DESC;

-- También se puede consultar el Parquet directamente
SELECT * FROM '03_datos/procesados/lecturas.parquet' LIMIT 5;
```

## Migrar a PostgreSQL / Supabase (mismo esquema)

DuckDB puede escribir directo en Postgres:

```sql
INSTALL postgres; LOAD postgres;
ATTACH 'postgresql://USER:PASS@HOST:5432/postgres' AS pg (TYPE postgres);
CREATE TABLE pg.public.lecturas AS SELECT * FROM lecturas;   -- repetir por tabla
```

Alternativas: `COPY` de cada Parquet con `pg_parquet`/`duckdb`, o `pandas.read_parquet(...).to_sql(...)`.
Tras cargar, en Postgres:
- `lecturas`: índice `(id_lugar, variable, fecha)` y `(fecha_emision)`; si crece mucho, particionar por `tipo`.
- `tags` y `propiedades`: convertir a `JSONB` (`ALTER TABLE ... ALTER COLUMN tags TYPE jsonb USING tags::jsonb`).
- Con PostGIS: `geom = ST_SetSRID(ST_MakePoint(lon, lat), 4326)` en `infraestructura_osm`, `cenepred_coen`, `localidades`.
- Claves: `localidades.id_lugar` PK; `distritos_riesgo.ubigeo` PK; `localidades.ubigeo` FK a distritos.
- En Supabase, activar RLS con política de solo lectura para el rol `anon` si se expone a la app.

## Problemas de calidad conocidos
- **Niño semanal incompleto (bug del recolector, corregido en código, falta re-descargar)**: el archivo NOAA pega
  los negativos al valor anterior (`24.1-0.2`); `split()` daba menos de 9 campos y la semana se descartaba.
  Por eso `nino_semanal.csv` tiene sólo 628 semanas y ninguna anomalía negativa (sesgo cálido).
  Corregido en `recolector/recolectar_todo.py::nino` y `recolector/fuentes.py::nino_noaa`; volver a correr el recolector.
- Ensemble de lluvia Open-Meteo: 18 valores de −0.1/−0.2 mm (artefacto del modelo). Se cargan tal cual y
  la fuente queda con `ERROR_VALIDACION`; tratarlos como 0 en el análisis.
- GloFAS reanálisis: sin datos 1984-01-01 a 1996-12-31 (4 749 días nulos por río); datos válidos desde 1997.
- ERA5: GRAU-01, GRAU-02 y GRAU-05 caen en la misma celda y tienen series idénticas.
- Talara (GRAU-03) no tiene ubigeo: su distrito (Pariñas) no está entre los 65 distritos de las capas CENEPRED descargadas.
- `crudos/climatologia/glofas_chira_2000_2025.json` es una lista sin fechas: no se carga.
- `crudos/<fecha>/noaa_nino.json` no se carga (duplica `nino_semanal.csv`).
