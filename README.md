# AlertaHídrica Piura

**Cuántas horas de agua le quedan a cada barrio antes de que El Niño corte el servicio, y qué hacer ahora.**

Hackathon Sunass "Lideresas por el Agua" · Desafío 2: Resiliencia hídrica · 2026

## El problema

Con El Niño, el río Piura arrastra lodo, las plantas de agua se detienen y miles de familias quedan sin agua por días. SENAMHI y ENFEN avisan que vienen lluvias, pero nadie le dice a EPS Grau qué barrio se quedará sin agua ni cuándo.

## La solución

Un gemelo digital ligero del sistema de agua de Piura, del río al hogar:

1. **Anticipa la amenaza**: probabilidad diaria, a 15 días, de que el río o la lluvia superen cada umbral (51 pronósticos públicos).
2. **Calcula el impacto**: horas de agua que quedan en cada localidad, faltante y cisternas necesarias.
3. **Activa la respuesta**: alertas con causa, acción, responsable y plazo para EPS Grau, Sunass, COE y salud, y avisos claros para los hogares.

## Qué hay en este repositorio

| Carpeta | Qué hace |
|---|---|
| `recolector/` | Descarga fuentes públicas (GloFAS, ECMWF, NOAA, CENEPRED, ANA, SENAMHI, OpenStreetMap, CDC) y calcula el pronóstico |
| `analisis/` | Base centralizada (DuckDB) y los 7 niveles de análisis: descriptivo, correlacional, diagnóstico, predictivo, preventivo, prescriptivo y continuo |
| `web/` | Aplicación: centro de decisión, gemelo digital, mapa, pronóstico, análisis, datos, hoja de ruta y vista ciudadana |
| `.github/workflows/` | Actualización automática del pronóstico cada 6 horas |

## Cómo correrlo

```bash
cd recolector && pip install -r requirements.txt && python recolectar_todo.py && python pronostico.py
cd ../analisis && python 00_datos/centralizar.py && python exportar_web.py
cd ../web && npm install && npm run dev      # http://localhost:5173
```

## Qué es real y qué no

- **Real**: pronósticos de caudal y lluvia, temperatura del mar, riesgo por distrito (CENEPRED), infraestructura y estaciones.
- **Supuesto**: volúmenes de reservorios, producción y turbiedad de EPS Grau (se pedirán por Ley N.º 27806).
- **Demostración**: el modelo de corte usa datos simulados hasta contar con el expediente completo.

La aplicación muestra esta distinción en cada pantalla.

## Datos y uso responsable

Solo datos públicos, descargados identificándose con un nombre real, respetando límites y sin evadir bloqueos. No se guardan datos personales (Ley N.º 29733). Los datasets del expediente de Sunass no se incluyen por ser de uso exclusivo de la hackathon.

## Cómo leer el historial

Los commits siguen el orden en que se pensó el proyecto: primero el problema y la investigación (`docs/`), luego la arquitectura, el motor del semáforo, la recolección de datos, los siete niveles de análisis y al final la aplicación.

El historial se ordenó por etapas al cerrar el prototipo, para que se pueda recorrer paso a paso. Cada commit agrega una pieza completa; las versiones intermedias de trabajo están en la rama `respaldo-checkpoints`.

| Para entender… | Empieza por |
|---|---|
| El problema y a quién ayuda | `docs/01_problema_y_objetivos.md` |
| Qué existe y qué falta | `docs/02_investigacion.md` |
| Por qué esta arquitectura | `docs/03_arquitectura.md` |
| Los siete niveles de análisis | `docs/04_plan_modelos_y_datos.md` |
| El estilo visual | `docs/05_estilo_visual.md` |
