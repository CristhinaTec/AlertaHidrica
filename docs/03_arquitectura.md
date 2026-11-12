# 3. Arquitectura (registro de decisión)

## Contexto

Equipo de 4 personas (2 programadoras), sprint de 2 días, entregables: interfaz para decisores, interfaz ciudadana y código público. Después, transferencia a Sunass o a la EPS. Volumen de datos pequeño: 6 localidades y unas 300 000 lecturas.

## Opciones evaluadas

| Opción | Ventaja | Desventaja | Decisión |
|---|---|---|---|
| Todo en Streamlit con archivos locales | Rápida | No escala; aspecto poco cuidado | Descartada |
| FastAPI + PostgreSQL + React | Profesional | Demasiado trabajo para el sprint | Descartada |
| **Python modular + base analítica + React estático + tareas programadas** | Gratis, estable, transferible | Depende de servicios gratuitos | **Elegida** |

## Diseño

```
Fuentes públicas ─► Recolector (Python) ─► Base única (DuckDB/Parquet) ─► Motor de 7 niveles (Python) ─► JSON ─► Aplicación (React)
                    cada 6 h (GitHub Actions)                                                                 Centro de decisión, gemelo, mapa, ciudadanía
```

## Cinco decisiones que la hacen sostenible

1. **Una sola tabla de lecturas** (`fecha, lugar, variable, valor, unidad, fuente, tipo`). Un sensor real, uno simulado o un dato público entran igual: pasar del piloto a producción no cambia el código.
2. **Umbrales y protocolo en archivos editables** (`reglas.yaml`, `protocolo.yaml`), no dentro del código. La EPS los ajusta sin programar.
3. **Tareas programadas en GitHub Actions**: sin servidor propio y auditables.
4. **Formatos estándar** (Parquet, esquema compatible con PostgreSQL): migrables a los servidores de Sunass.
5. **Respaldo por variable**: si una fuente falla, se usa la siguiente y se avisa que la confianza bajó.

## Tecnologías

| Pieza | Elección | Por qué |
|---|---|---|
| Recolección y análisis | Python, pandas, scikit-learn, OR-Tools | Conocido por el equipo, abierto |
| Base | DuckDB + Parquet | Cero infraestructura; consulta SQL directa |
| Validación | Pandera | Ningún dato entra sin cumplir su contrato |
| Interfaz | React, Vite, Tailwind, shadcn/ui, Leaflet, Recharts | Rápida, accesible, funciona bien en celular |
| Automatización | GitHub Actions | Gratis y transparente |

## Qué revisar cuando crezca

Servidor propio de mensajería (MQTT) con más de 50 sensores; PostgreSQL/PostGIS para varias EPS; convenio con INDECI para SISMATE; modelo hidráulico de red (EPANET/WNTR) cuando EPS Grau comparta su red.
