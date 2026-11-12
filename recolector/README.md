# Recolector de AlertaHídrica Piura

Descarga fuentes públicas, guarda una copia cruda con fecha y calcula el pronóstico probabilístico por localidad y día.

```bash
pip install -r requirements.txt
python pronostico.py   # escribe ../web/public/data/pronostico.json
```

| Fuente | Qué trae | Acceso | Estado |
|---|---|---|---|
| GloFAS vía Open-Meteo Flood API | Caudal de ríos Piura y Chira, 51 miembros, 15 días + histórico 2000-2025 | API sin clave | Integrada |
| ECMWF IFS ensemble vía Open-Meteo | Lluvia diaria por localidad, 51 miembros, 15 días | API sin clave | Integrada |
| NOAA CPC | Anomalía de temperatura del mar Niño 1+2 y 3.4 (semanal) | Archivo de texto | Integrada |
| ENFEN | Estado de alerta | PDF, carga manual en `config.py` | Manual |
| SENAMHI estaciones y avisos, CENEPRED SIGRID (ArcGIS REST), GEOCATMIN, CHIRPS, IMERG, Overpass, INEI, CDC-MINSA | Ver expediente de investigación | Scraping / REST / descarga | Siguientes conectores |

Calibración: el caudal GloFAS del río Piura se multiplica por 1,35 (pico observado 2017 de 3 468 m³/s / pico GloFAS 2569 m³/s). Es aproximado, con un solo evento.
Para el río Chira, sin umbrales oficiales verificados, se usan percentiles 90/97/99,5 de la climatología GloFAS.
