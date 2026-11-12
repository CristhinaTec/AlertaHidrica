# Nivel 1 — Descriptivo (DATOS REALES)

Origen: ERA5 (Open-Meteo) 2000-2025, GloFAS reanálisis 1997-2025, NOAA CPC Niño 1+2, CENEPRED ER_NINO2027, OSM. Script `01_descriptivo/descriptivo.py`.

## Lluvia ERA5 por localidad
| nombre                |   media_diaria |   p95 |   max |   dias_ge20mm |   anual_mediana_mm |   anual_2017_mm |   anual_2023_mm |
|:----------------------|---------------:|------:|------:|--------------:|-------------------:|----------------:|----------------:|
| Piura                 |            0.7 |   3.4 | 130.6 |            48 |              177.8 |          1197.9 |           787.8 |
| Castilla              |            0.8 |   3.8 | 130.6 |            62 |              220.9 |          1197.9 |           787.8 |
| Talara                |            0.4 |   1.6 |  70.9 |            24 |              103.9 |           630.3 |           526.9 |
| Veintiséis de Octubre |            0.7 |   3.4 | 130.6 |            48 |              177.8 |          1197.9 |           787.8 |
| Sullana               |            0.8 |   3.5 | 105.3 |            71 |              201.2 |          1311.9 |           968.5 |
| Paita                 |            0.4 |   1.7 |  70.1 |            20 |              101.7 |           666.6 |           462.3 |

## Caudal GloFAS (m³/s, crudo)
| id_lugar   |   count |   mean |   std |   min |   50% |   90% |   99% |   max | origen                               |
|:-----------|--------:|-------:|------:|------:|------:|------:|------:|------:|:-------------------------------------|
| rio_chira  |   10592 |    377 |   515 |    37 |   143 |   903 |  2525 |  5199 | real_glofas (crudo, sin factor 1.35) |
| rio_piura  |   10592 |    102 |   240 |     0 |    35 |   228 |  1156 |  4570 | real_glofas (crudo, sin factor 1.35) |

Picos anuales top-5:
| id_lugar   |   anio |   valor |
|:-----------|-------:|--------:|
| rio_chira  |   1998 | 5198.96 |
| rio_chira  |   2017 | 4908.08 |
| rio_piura  |   1998 | 4569.88 |
| rio_chira  |   1997 | 4384.31 |
| rio_chira  |   2015 | 4007.67 |
| rio_chira  |   2021 | 3579.96 |
| rio_piura  |   2017 | 2569.4  |
| rio_piura  |   2016 | 1444.44 |
| rio_piura  |   2002 | 1379.38 |
| rio_piura  |   2008 | 1290.22 |

## Niño 1+2
|   count |   mean |   std |   min |   25% |   50% |   75% |   max |   semanas_gt1 |   semanas_gt2 | ultima_fecha        |   ultima_anom |   semanas_negativas | origen    |
|--------:|-------:|------:|------:|------:|------:|------:|------:|--------------:|--------------:|:--------------------|--------------:|--------------------:|:----------|
|    2358 |   0.03 |  1.19 |  -2.5 |  -0.8 |  -0.2 |   0.6 |   5.6 |           339 |           167 | 2026-11-04 00:00:00 |           5.6 |                1312 | real_noaa |

## CENEPRED: población por nivel de riesgo de inundación
| nriesgo_in   |   distritos |   poblacion |   pobreza_media |   eess_expuestos | origen        |
|:-------------|------------:|------------:|----------------:|-----------------:|:--------------|
| Alto         |          21 |      333465 |           30.74 |              136 | real_cenepred |
| Bajo         |           6 |       35406 |           51.22 |                0 | real_cenepred |
| Medio        |          11 |      130356 |           48.19 |               11 | real_cenepred |
| Muy alto     |          27 |     1357582 |           28.69 |              812 | real_cenepred |

## Infraestructura OSM (radio 8 km)
| id_lugar   | nombre                |   amenity=school |   waterway=canal |   amenity=clinic |   man_made=water_tower |   waterway=stream |   amenity=hospital |   amenity=doctors |   man_made=storage_tank |   man_made=wastewater_plant |   man_made=water_works |   waterway=river |   man_made=reservoir_covered | origen                                 |
|:-----------|:----------------------|-----------------:|-----------------:|-----------------:|-----------------------:|------------------:|-------------------:|------------------:|------------------------:|----------------------------:|-----------------------:|-----------------:|-----------------------------:|:---------------------------------------|
| GRAU-01    | Piura                 |              341 |               57 |               49 |                     37 |                29 |                 13 |                 5 |                       5 |                           2 |                      1 |                1 |                            0 | real_osm (completitud OSM desconocida) |
| GRAU-02    | Castilla              |              324 |               42 |               47 |                     34 |                14 |                 12 |                 5 |                       4 |                           2 |                      1 |                1 |                            0 | real_osm (completitud OSM desconocida) |
| GRAU-05    | Veintiséis de Octubre |              315 |               70 |               47 |                     31 |                25 |                 12 |                 5 |                       5 |                           1 |                      1 |                0 |                            0 | real_osm (completitud OSM desconocida) |
| GRAU-06    | Sullana               |              122 |               29 |               12 |                      9 |                 1 |                  6 |                 4 |                       3 |                           0 |                      2 |                2 |                            0 | real_osm (completitud OSM desconocida) |
| GRAU-27    | Paita                 |               31 |                0 |                3 |                      1 |                 0 |                  3 |                 0 |                       8 |                           2 |                      0 |                0 |                            1 | real_osm (completitud OSM desconocida) |
| GRAU-03    | Talara                |               74 |                0 |                4 |                      1 |                17 |                  2 |                 1 |                     110 |                           0 |                      0 |                2 |                            0 | real_osm (completitud OSM desconocida) |

## Calidad (Pandera)
| dataset             | pandera   | detalle   |
|:--------------------|:----------|:----------|
| lluvia ERA5         | OK        |           |
| caudal GloFAS>=1997 | OK        |           |
| nino12 anom         | OK        |           |
| CENEPRED            | OK        |           |

- Huecos de fecha en lluvia ERA5 por localidad: {'GRAU-01': 0, 'GRAU-02': 0, 'GRAU-03': 0, 'GRAU-05': 0, 'GRAU-06': 0, 'GRAU-27': 0}
- Series ERA5 idénticas (misma celda ~25 km): [('GRAU-01', 'GRAU-05')]
- Niño 1+2: 2358 semanas, 1312 anomalías negativas (bug conocido del recolector: sesgo cálido)
- GloFAS 1984-1996 nulo: se usa desde 1997. Talara (GRAU-03) sin ubigeo CENEPRED.
- ydata-profiling no instalado: informe propio (pip install ydata-profiling para el perfil completo).

Expediente DS01-DS08: ver `01_descriptivo/cargar_expediente.py` (contratos listos; hoy en modo DEMO-SINTÉTICO).