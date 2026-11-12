# Nivel 6 — Prescriptivo: prioridad, despacho de cisternas y rutas

> **AVISO:** flota derivada de n5 (volúmenes/producción EPS SUPUESTOS); demandas por punto SUPUESTAS. Puntos de atención reales: OSM (hospitales, clínicas, consultorios, colegios) + IPRESS afectadas COESALUD (CENEPRED).

## Método

- Puntos dentro de 8 km del centro de una de las 6 localidades EPS; distrito = distrito de la localidad (aproximación).
- Puntaje = 60·peso_tipo (hospital/clínica 1.0, IPRESS 0.9, consultorio 0.6, colegio 0.4) + 15·riesgo CENEPRED (niv_sinu) + 15·pobreza relativa + 10 si IPRESS afectada en lluvias previas.
- Voraz: capacidad = 730 cisternas × 20 m³ × 4 viajes = **58,400 m³/día**.
- Protocolo por color: `analisis/protocolo.yaml` (PROPUESTA A VALIDAR).

## Resultados

- Puntos evaluados: **675** — hospital: 24, clinica: 68, ipress_coesalud: 4, consultorio: 10, colegio: 569
- Demanda total: **1,933 m³/día**; asignado: **1,933 m³/día**; capacidad sobrante: 56,467 m³/día. Cisternas mínimas para cubrir solo estos puntos: **25** (el resto de la flota n5 atiende puntos de reparto barriales fuera de esta lista, regla fraccionPrioritaria=15 % del déficit).
- Cobertura: total: 675
- Por localidad: Sullana: 146, Veintiséis de Octubre: 114, Castilla: 81, Paita: 38, Talara: 81, Piura: 215

### Top 15 de la lista de despacho

| # | Punto | Tipo | Localidad | Puntaje | m³/día |
|---|---|---|---|---|---|
| 1 | Hospital de apoyo II de Sullana / HOSPITAL DE APOYO II-2  SU | hospital | Sullana | 99.13 | 20 |
| 2 | Centro de Salud Bellavista / BELLAVISTA | clinica | Sullana | 99.13 | 6 |
| 3 | Establecimiento de Salud Villa Primavera / CENTRO DE SALUD " | clinica | Sullana | 99.13 | 4 |
| 4 | Establecimiento de Salud  I-3 09 de Octubre / CENTRO DE SALU | clinica | Sullana | 99.13 | 4 |
| 5 | Establecimiento de Salud Santa Teresita / SANTA TERESITA | clinica | Sullana | 99.13 | 4 |
| 6 | Nuevo Sullana / CENTRO DE SALUD NUEVO SULLANA | clinica | Sullana | 99.13 | 4 |
| 7 | Hospital de Apoyo Santa Rosa / HOSPITAL DE LA AMISTAD PERU - | hospital | Veintiséis de Octubre | 96.87 | 20 |
| 8 | Centro Médico Materno El Hogar de la Madre / CENTRO MATERNO  | clinica | Castilla | 96.87 | 6 |
| 9 | Establecimiento de salud María Goretti / MARIA GORETTI | clinica | Castilla | 96.87 | 4 |
| 10 | Establecimiento de Salud I-3 El Indio / E.S. EL INDIO | clinica | Castilla | 96.87 | 4 |
| 11 | Puesto de Salud San Sebastian / E.S. SAN SEBASTIAN | clinica | Veintiséis de Octubre | 96.87 | 4 |
| 12 | Centro de Salud Micaela Bastidas / E.S. MICAELA BASTIDAS | clinica | Veintiséis de Octubre | 96.87 | 4 |
| 13 | Hospital Las Mercedes-Paita / CENTRO DE SALUD MENTAL COMUNIT | hospital | Paita | 96.25 | 20 |
| 14 | CENTRO DE SALUD MENTAL COMUNITARIO  "JESÚS REDENTOR" | ipress_coesalud | Sullana | 93.13 | 3 |
| 15 | CIENEGUILLO SUR ALTO | ipress_coesalud | Sullana | 93.13 | 1 |

## Ruteo

- Método: OR-Tools CVRP (PATH_CHEAPEST_ARC + GLS, 30 s). Nodos (puntos de salud, partidos a ≤20 m³): 106.
- Viajes: **40** (≈ 10 cisternas a 4 viajes/día), **2,042 km** totales ida y vuelta en línea recta, 795 m³.
- Colegios/albergues se atienden con la lista voraz (no ruteados).

Limitaciones: base única en Piura (Talara está a ~100 km: en operación real conviene base por provincia); distancias haversine sin red vial ni tiempos; no se modelan ventanas horarias ni duración de jornada; la flota de n5 corresponde al escenario condicional rojo (peor caso), no a la flota real disponible de EPS Grau.