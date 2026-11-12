# AlertaHídrica Piura: plan de modelos, recolección de datos y viabilidad

Actualizado: 8 de noviembre de 2026 · Desafío 2, Resiliencia hídrica · Hackathon Sunass "Lideresas por el Agua"

---

## 1. Dónde estamos

| Pieza | Estado | Dónde está |
|---|---|---|
| Análisis de bases, formato y asesorías | ✅ Hecho | `00_bases_y_programa/`, `01_asesorias_fase2/` |
| Investigación verificada (46 referencias APA) | ✅ Hecho | Expediente de investigación del equipo |
| Arquitectura, modelos, variables e IoT | ✅ Diseñados | Documento de investigación, secciones 9 y 10 |
| Prototipo React (tablero, simulador, consulta ciudadana) | ✅ Funciona con datos simulados de la EPS | `04_desarrollo/web` · `npm run dev` |
| **Recolector de pronóstico** (GloFAS, ECMWF, NOAA) | ✅ Funciona con datos reales | `04_desarrollo/recolector/pronostico.py` |
| **Pantalla de pronóstico a 15 días** | ✅ Funciona con datos reales | http://localhost:5173/pronostico |
| **Recolector masivo** (19 conectores) | ✅ 16 de 19 responden | `04_desarrollo/recolector/recolectar_todo.py` |
| Tarea automática cada 6 h (GitHub Actions) | ✅ Escrita; se activa al subir el repositorio | `04_desarrollo/.github/workflows/recolectar.yml` |
| Base de datos en Supabase | ❌ No creada | — |
| Análisis de los datasets del expediente (DS01–DS08) | ❌ **Bloqueado: faltan los Excel** | Copiar a `03_datos/expediente_desafio2/` |
| Modelo de falla y validación 2017/2023 | ❌ Diseñado; depende de los Excel | — |
| Documento técnico v4 (2 páginas) y guion del video | ❌ **Vencen el 12 de noviembre, 5:00 p. m.** | — |

---

## 2. Datos recolectados de internet

Corrida del 8 de noviembre de 2026: **16 de 19 conectores respondieron**, 39 archivos y 9,3 MB en `03_datos/externos/`. El detalle de cada corrida queda en `03_datos/externos/inventario.json`.

Reglas del recolector: se identifica siempre con su nombre real (`AlertaHidrica-Piura/0.1`), respeta los límites de peticiones (espera y reintenta si el servidor responde 429), **no imita navegadores ni evade bloqueos anti-bots y no desactiva la verificación SSL**, y guarda una copia de cada fuente con fecha.

### 2.1 Fuentes con datos útiles

| Fuente | Capa | Método | Qué se obtuvo | Archivo |
|---|---|---|---|---|
| **CENEPRED SIGRID: escenario de riesgo El Niño 2027** | Exposición y vulnerabilidad | ArcGIS REST | **65 distritos de Piura** con nivel de riesgo por inundación y por movimientos en masa, población, viviendas, centros de salud y colegios expuestos. 20 distritos en riesgo **muy alto**, entre ellos **Sullana, Veintiséis de Octubre, Castilla y Piura** | `cenepred/ER_NINO2027_BD_4_*.geojson`, `_5_*` |
| **CENEPRED / COEN FEN 2027** | Gestión del riesgo | ArcGIS REST | 296 manzanas de Piura, 34 puntos críticos 2027 (cuenca, actividad, volumen), 28 intervenciones, 82 establecimientos de salud afectados, 46 maquinarias, 36 comisarías, 9 compañías de bomberos, almacenes | `cenepred/COEN_FEN_2027_*.geojson` |
| **GloFAS reanálisis** (vía Open-Meteo) | Amenaza | API | Caudal diario de 1984 a 2025 de los ríos Piura y Chira (15 341 días cada uno). Pico: marzo de 1998 | `glofas/caudal_historico_*.csv` |
| **GloFAS + ECMWF ensemble** | Amenaza | API | Caudal y lluvia a 15 días, 51 pronósticos posibles | `crudos/<fecha>/` y `web/public/data/pronostico.json` |
| **Open-Meteo Archive (ERA5)** | Amenaza | API | Lluvia y temperatura diaria 2000–2025 en las 6 localidades (56 982 filas) | `open_meteo/lluvia_historica_*.csv` |
| **Open-Meteo pronóstico 16 días** | Amenaza | API | Lluvia y probabilidad de lluvia por localidad | `open_meteo/pronostico_16d.json` |
| **ECMWF SEAS5 estacional** | Amenaza | API | Lluvia a 6 meses, 51 miembros | `open_meteo/estacional_piura.json` |
| **NOAA CPC índices Niño** | Amenaza | Archivo de texto | 628 semanas desde 1990. Niño 1+2: **+5,4 °C** (28 de octubre de 2026) | `noaa/nino_semanal.csv` |
| **NOAA ONI** | Amenaza | Archivo de texto | 921 registros desde 1950. Último (ASO 2026): **+2,46 °C** | `noaa/oni.csv` |
| **OpenStreetMap (Overpass)** | Exposición | API | 2 121 elementos en Piura: 40 hospitales, 138 clínicas, 1 108 colegios, 161 tanques, 87 torres de agua, 15 reservorios, 8 plantas de agua, 353 canales, 51 ríos | `osm/piura_infraestructura.json` |
| **Sunass, agenda temprana 2025** | Servicio | PDF | Interrupciones nacionales 2020–2024 | `sunass/anexo_agenda_temprana_2025.pdf` |
| **INDECI, directiva SISMATE** | Gestión del riesgo | PDF | Reglas de emisión de alertas al celular | `indeci/directiva_sismate_2024.pdf` |
| **CHIRPS v3** | Amenaza | Descarga directa | Catálogo de productos (diario, decadal, mensual) | `chirps/listado.json` |

### 2.2 Fuentes que respondieron sin datos útiles

| Fuente | Qué pasó | Alternativa |
|---|---|---|
| SENAMHI, avisos | La página carga los avisos con JavaScript; solo se obtuvo el menú (13 textos) | Leer los avisos PDF que enlaza la página, o pedir el servicio a SENAMHI |
| SENAMHI, estaciones | 816 códigos de estación, pero ninguno etiquetado como Piura en el HTML | Ubicar el código de la estación Sánchez Cerro y su endpoint interno con el equipo |
| CDC-MINSA, dengue | Redirige a una aplicación Shiny (`app7.dge.gob.pe`) que no expone datos en el HTML | Descarga manual semanal del reporte o pedido al CDC |
| EPS Grau | No hay avisos de corte en la página de inicio | Comunicados en Facebook (carga manual) o pedido a la EPS |
| ANA SNIRH | La página del observatorio no muestra Poechos en el HTML | Pedido a ANA o PECHP |

### 2.3 Fuentes que no respondieron

| Fuente | Motivo | Qué hacer (sin evadir controles) |
|---|---|---|
| INGEMMET GEOCATMIN | Error de certificado SSL del servidor | Avisar a INGEMMET o descargar las capas a mano desde su visor |
| ENOSA (Distriluz) | Error de certificado SSL del servidor | Revisar a mano o pedir a ENOSA el calendario de cortes |
| datosabiertos.gob.pe | La API redirige a una página que no existe (404) y el portal bloquea clientes automáticos | Descargar los datasets a mano desde el portal |

### 2.4 Fuentes sin conector todavía

Requieren pedido formal (Ley N.º 27806), cuenta o descarga manual:

| Fuente | Por qué importa | Cómo conseguirla |
|---|---|---|
| **EPS Grau**: volumen de reservorios, producción, turbiedad | Es la autonomía real | Solicitud por Ley N.º 27806 (pendiente de enviar) |
| **PECHP / ANA**: Poechos y canal Daniel Escobar | Curumuy depende de ellos | Solicitud o convenio |
| **CAMI YAKU**: interrupciones históricas | Validar el modelo con cortes reales | Pedido a Sunass (organizadora) |
| **GloFAS reforecast** (Copernicus CDS) | Pronóstico retrospectivo de 2017 y 2023 | Cuenta gratuita en el Climate Data Store |
| **Censos INEI** (REDATAM) | Hogares en Paita y Talara | Consulta interactiva y exportación |
| **RENIPRESS, ESCALE** | Hospitales y colegios oficiales | Descarga manual |
| **Google Earth Engine** (Sentinel-2, Sentinel-1, SMAP) | Turbiedad e inundación satelital | Cuenta académica gratuita |

---

## 3. Los siete niveles: cómo hacerlos y qué tan viables son

### Cómo se calcula la viabilidad

El porcentaje estima la probabilidad de entregar el nivel **funcionando y validado en el sprint (26 y 27 de noviembre)**. Considera tres cosas: si los datos ya están disponibles (40 %), la dificultad técnica para el equipo (30 %) y las dependencias externas (30 %). Es un juicio del equipo, no una medición.

| Nivel | Viabilidad en el sprint | Viabilidad con datos reales de la EPS (fase 5) | Bloqueo principal |
|---|---|---|---|
| 1. Descriptivo | **95 %** | 95 % | Copiar los Excel |
| 2. Correlacional | **85 %** | 90 % | Datos simulados con correlaciones infladas |
| 3. Diagnóstico | **80 %** | 85 % | Revisión de pesos por las ingenieras |
| 4. Predictivo (amenaza) | **95 %** (ya funciona) | 95 % | — |
| 4. Predictivo (falla y duración) | **60 %** | 75 % | Entrenamiento con datos simulados; cuenta CDS |
| 5. Preventivo | **85 %** | 70 % | Volúmenes reales de reservorios |
| 6. Prescriptivo (protocolo y priorización) | **75 %** | 80 % | Validación con EPS y COE |
| 6. Prescriptivo (ruteo óptimo de cisternas) | **50 %** | 70 % | Tiempo; red vial y puntos de reparto |
| 7. Cognitivo y continuo | **25 %** | 70 % | Necesita varias temporadas y operación real |

### Base común

```
04_desarrollo/analisis/
├── 00_datos/        carga + validación Pandera (toda tabla pasa por aquí)
├── 01_descriptivo/  02_correlacional/  03_diagnostico/
├── 04_predictivo/   05_preventivo/     06_prescriptivo/  07_continuo/
└── salidas/         tablas, gráficos e informes
```

Regla: ninguna tabla entra al análisis sin pasar por un contrato **Pandera** (columnas, tipos, rangos, claves únicas). Si el dato no cumple, el script se detiene y dice qué falló.

---

### Nivel 1. Descriptivo: ¿qué pasó? · Viabilidad 95 %

**Datos:** DS01–DS05 y DS08 · interrupciones de la agenda temprana de Sunass · escenario de riesgo de CENEPRED (ya descargado).

**Pasos**
1. Un contrato Pandera por dataset: `duracion_h ≥ 0`, `fecha_fin ≥ fecha_inicio`, turbiedad entre 0 y 10 000 NTU, `id_componente` existente en DS02.
2. Informe automático de calidad con `ydata-profiling`: nulos, duplicados, distribuciones.
3. Correcciones con reglas escritas: quitar los 71 duplicados, marcar los 267 cortes sin cierre, revisar la turbiedad de 4 000 NTU.
4. Cortes por mes y año; duración por tipo de componente (mediana y P90); top de localidades; perfil de hogares con factor de expansión.
5. **Nuevo:** cruzar las localidades de EPS Grau con el riesgo por distrito de CENEPRED.

**Herramientas:** pandas, Pandera, ydata-profiling, plotly.
**Salida:** `salidas/n1_calidad.html`, `salidas/n1_resumen.csv`.
**Criterio para aprobar:** contratos en verde · cada cifra reproducible con un comando · una segunda persona recalcula 3 cifras al azar y le dan igual.
**Responsables:** Programadora 1; revisa la ingeniera ambiental.
**Riesgo:** ninguno técnico; solo depende de copiar los Excel.

---

### Nivel 2. Correlacional: ¿qué se mueve junto? · Viabilidad 85 %

**Datos:** nivel 1 + lluvia 2000–2025 (ERA5, ya descargada) + caudal 1984–2025 (GloFAS, ya descargado) + Niño 1+2 y ONI (NOAA, ya descargados).

**Pasos**
1. Tabla panel localidad × mes (escala real de los datos simulados) y localidad × día (para los datos reales).
2. Variables con desfase: lluvia acumulada de 1, 3 y 7 días antes; caudal máximo de los 3 días previos; anomalía Niño 1+2 del mes anterior.
3. Correlación de Spearman y correlación cruzada con desfase.
4. Meses con El Niño (1998, 2017, 2023) frente a meses normales: prueba de Mann-Whitney.
5. **Con datos 100 % reales:** caudal GloFAS frente a las emergencias de INDECI y a los años de El Niño, para no depender de los datos simulados.

**Herramientas:** pandas, scipy, statsmodels.
**Salida:** `salidas/n2_desfases.csv` y gráfico de días de anticipación.
**Criterio para aprobar:** la relación se repite con datos reales · se reporta como relación, no como causa.
**Responsables:** Programadora 1; la ingeniera agrícola valida el sentido hidrológico.
**Riesgo:** los datos simulados ya contienen la lluvia (correlaciones infladas). Se mitiga con el paso 5.

---

### Nivel 3. Diagnóstico: ¿por qué pasó? · Viabilidad 80 %

**Datos:** DS02 y DS03 + CENEPRED (riesgo por distrito, puntos críticos 2027) + OSM (plantas, tanques, canales).

**Pasos**
1. Pareto de causas de los cortes de 72 h o más en Piura.
2. Índice de vulnerabilidad por componente:

   `IV = 0,30·exposición + 0,25·cruza_quebrada + 0,20·sin_generador + 0,15·antigüedad + 0,10·estado`

   Pesos iniciales de las ingenieras.
3. Regresión logística "¿tuvo corte largo?" para contrastar los pesos.
4. **Nuevo:** superponer los componentes con los 34 puntos críticos 2027 de CENEPRED y el nivel de riesgo del distrito.
5. Validar con hechos documentados: Curumuy (2025), Contraloría (2023).

**Herramientas:** pandas, scikit-learn, geopandas.
**Salida:** `salidas/n3_indice_componentes.csv` y capa en el mapa.
**Criterio para aprobar:** el top 10 coincide con los casos documentados · las dos ingenieras lo firman.
**Riesgo:** las coordenadas de DS02 son ficticias; el cruce espacial con CENEPRED se hace por distrito, no por punto exacto.

---

### Nivel 4. Predictivo: ¿qué va a pasar y cuándo? · Viabilidad 95 % (amenaza) / 60 % (falla)

**Datos:** GloFAS y ECMWF ensemble (ya en producción) + modelos de los niveles 2 y 3.

**Pasos**
1. **Amenaza (ya funciona):** probabilidad diaria a 15 días de superar cada umbral, con 51 pronósticos posibles.
2. **Falla:** regresión logística (scikit-learn), comparada con LightGBM; explicación de cada predicción con SHAP.
3. **Duración:** mediana por causa y tipo de componente, o regresión sobre el logaritmo de las horas.
4. **Probabilidad final por día** = Σ sobre los miembros [probabilidad de falla dada la amenaza de ese miembro] / 51.

**Validación**
- Entrenar con 2023 y probar con 2017, y al revés.
- Pronóstico retrospectivo con `cems-glofas-reforecast` (Copernicus CDS) para marzo de 2017 y marzo de 2023.
- Métricas: aciertos, omisiones, falsas alarmas, puntaje de Brier, curva de calibración, días de anticipación; siempre frente a la regla "alertar todo febrero y marzo".

**Herramientas:** scikit-learn, LightGBM, SHAP, cdsapi.
**Salida:** `salidas/n4_modelo.pkl`, `salidas/n4_validacion.html`, columna `p_corte` en `pronostico.json`.
**Criterio para aprobar:** supera a la regla simple · calibración aceptable · se declara que el entrenamiento usó datos simulados.
**Riesgo:** pocos eventos extremos (2017, 2023) y datos simulados: la precisión será ilustrativa. La calibración del caudal usa un solo evento (factor 1,35).

---

### Nivel 5. Preventivo: ¿cuánto aguantamos? · Viabilidad 85 % (simulado) / 70 % (real)

**Datos:** nivel 4 + volúmenes, producción, demanda y pérdidas (supuestos editables hasta tener datos de EPS Grau) + sensores simulados.

**Pasos**
1. Pasar el motor del semáforo de TypeScript a Python para el cálculo diario (el tablero conserva el suyo para el simulador).
2. Balance día por día con producción reducida según turbiedad y energía pronosticadas; autonomía proyectada a 15 días.
3. Semáforo de probabilidad × impacto: matriz 4 × 4 (probabilidad del nivel 4; impacto = población × horas de déficit, con el riesgo CENEPRED del distrito).
4. Monte Carlo de 1 000 corridas: pérdidas 25–45 %, dotación y llenado; autonomía como rango ("30–42 h").

**Herramientas:** numpy, pandas.
**Salida:** autonomía y déficit por localidad y día en la base y en el tablero.
**Criterio para aprobar:** cada cifra con su confianza · un caso de Castilla reproducido a mano · supuestos visibles en `reglas`.
**Riesgo:** sin volúmenes reales, la autonomía es un supuesto. Por eso hay que enviar la solicitud a EPS Grau.

---

### Nivel 6. Prescriptivo: ¿qué hacemos y dónde primero? · Viabilidad 75 % (protocolo) / 50 % (ruteo)

**Datos:** nivel 5 + OSM (40 hospitales, 138 clínicas, 1 108 colegios, ya descargados) + CENEPRED (82 establecimientos de salud afectados, almacenes, maquinaria) + DS08.

**Pasos**
1. Protocolo por color: tabla "si nivel X, el actor Y hace Z en T horas", redactada con las ingenieras y validada en las mentorías.
2. Puntaje de prioridad por punto de reparto: hospitales > hogares sin red > menores de 5 años y adultos mayores > resto.
3. Asignación de cisternas: primero voraz (por puntaje hasta agotar la capacidad); luego ruteo de vehículos con **Google OR-Tools** sobre la red vial de OSM (**OSMnx**).
4. Mensajes por actor y canal (plantillas ya listas).

**Herramientas:** OR-Tools, OSMnx.
**Salida:** lista de despacho y ruta en el mapa.
**Criterio para aprobar:** la analista de la EPS confirma antes de un rojo · cada recomendación muestra su porqué · reglas versionadas en Git.
**Riesgo:** el ruteo óptimo puede no entrar en el sprint; el método voraz es la alternativa segura.

---

### Nivel 7. Cognitivo y continuo: ¿cómo aprende? · Viabilidad 25 % (sprint) / 70 % (fase 5)

**Pasos**
1. Guardar cada pronóstico emitido sin sobrescribirlo (el recolector ya guarda copias con fecha).
2. Comparar lo pronosticado con lo ocurrido (CAMI YAKU, INDECI, reportes ciudadanos).
3. Vigilancia de la deriva con **Evidently**.
4. Versionado de modelos con **MLflow**.
5. Recalibración al final de cada temporada con EPS Grau y Sunass.
6. Revisión de sesgos por distrito y nivel de pobreza (CENEPRED ya trae la pobreza por distrito).

**Criterio para aprobar:** informe por temporada firmado por la EPS y Sunass.
**Riesgo:** necesita operación real y varias temporadas. En el sprint se muestra solo el diseño y el registro de pronósticos.

---

## 4. Calendario

| Fecha | Qué | Niveles |
|---|---|---|
| **Hasta el 12 de noviembre, 5:00 p. m.** | Documento técnico v4 (2 páginas) + video de 3 minutos | 1 y 4 (amenaza) como evidencia |
| 13 al 17 de noviembre | Base en Supabase; análisis de niveles 1 a 3; enviar pedidos (EPS Grau, Sunass, PECHP); crear cuentas CDS y Earth Engine | 1, 2, 3 |
| 18 al 20 de noviembre (mentorías) | Revisar umbrales, índice y protocolo con los mentores | 2, 3, 6 |
| 26 y 27 de noviembre (sprint) | Modelo de falla validado, gemelo conectado al pronóstico real, protocolo y priorización | 4, 5, 6 |
| Fase 5 | Datos reales de EPS Grau, sensores piloto, recalibración | 5, 6, 7 |

---

## 5. Lo que necesita el equipo, en orden

1. **Copiar los Excel del expediente** a `03_datos/expediente_desafio2/`. Sin ellos no se pueden hacer los niveles 1 a 3 ni el modelo de falla.
2. **Enviar la solicitud por Ley N.º 27806** a EPS Grau (reservorios, producción, turbiedad). *No está enviada.*
3. **Crear cuentas gratuitas** en el Copernicus Climate Data Store y en Google Earth Engine.
4. **Descargar a mano** lo que bloquea a los bots: datosabiertos.gob.pe (dengue, RENIPRESS, emergencias), GEOCATMIN y el reporte semanal del CDC.
5. **Confirmar** los umbrales 900 / 1 290 / 1 900 m³/s con SENAMHI o el COER.

---

## 6. Cómo correr todo

```bash
# Recolección masiva (todas las fuentes) → 03_datos/externos/ + inventario.json
cd 04_desarrollo/recolector
pip install -r requirements.txt
python recolectar_todo.py            # o solo algunas: python recolectar_todo.py overpass sigrid

# Pronóstico de 15 días → web/public/data/pronostico.json
python pronostico.py

# Tablero
cd ../web && npm install && npm run dev   # http://localhost:5173
```
