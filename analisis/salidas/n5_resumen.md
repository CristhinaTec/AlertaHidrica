# Nivel 5 — Gemelo preventivo (balance 15 días, P×I, Monte Carlo)

> **AVISO:** Volúmenes, producción, dotación y conexiones de EPS Grau son SUPUESTOS (escenarios.ts). Pronóstico (GloFAS/ECMWF) y riesgo CENEPRED son datos reales.

Pronóstico usado: generado 2026-11-08T04:50:58+00:00. Script: `analisis/05_preventivo/gemelo.py`.

## Reglas

1. **Pérdida esperada de producción** del día: `L = 1.0·p_rojo + 0.5·(p_naranja−p_rojo) + 0.1·(p_amarillo−p_naranja)` (1.0 y 0.5 = `perdidaProduccion` de reglas.yaml; 0.1 en amarillo es supuesto).
2. **Balance diario**: almacenamiento inicial 90 % del volumen; `S(d+1) = clip(S + 24·(P·(1−L) − Q), 0, V)`; déficit = faltante no cubierto por el reservorio.
3. **Impacto condicional**: si el día d se materializa amenaza roja (producción 0 durante 87 h = duracionCorteH.captacion), horas sin agua = max(0, 87 − S_d/Q); impacto = población × horas × factor CENEPRED (niv_sinu: Muy alto 1.5, Alto 1.25, Medio 1.0, Bajo 0.85, Muy bajo 0.7 — factores supuestos).
4. **Monte Carlo** 1000 corridas: pérdidas de red U(25–45 %), dotación ×U(0.85–1.15), llenado U(50–95 %).

## Matriz probabilidad × impacto (4×4)

Probabilidad = `p_naranja` del día: Baja <0.10 ≤ Media <0.30 ≤ Alta <0.60 ≤ Muy alta. Impacto (persona·hora ajustada): Bajo <1 M ≤ Moderado <5 M ≤ Alto <20 M ≤ Muy alto. Color por suma de clases (1–4 c/u).

| Prob. \ Impacto | Bajo | Moderado | Alto | Muy alto |
|---|---|---|---|---|
| Muy alta | amarillo | naranja | rojo | rojo |
| Alta | amarillo | amarillo | naranja | rojo |
| Media | verde | amarillo | amarillo | naranja |
| Baja | verde | verde | amarillo | amarillo |

## Resultados por localidad

| Localidad | Distrito (niv_sinu) | Máx p_naranja | Día peor | Semáforo P×I | Déficit esperado 15 d (m³) | Autonomía si rojo P10–P50–P90 (h) | Autonomía si naranja P10–P90 (h) | Cisternas cond. |
|---|---|---|---|---|---|---|---|---|
| Piura | PIURA (Muy alto) | 0.02 | 2026-11-14 | amarillo | 0 | 16–20–27 | 31–66 | 239 |
| Castilla | CASTILLA (Muy alto) | 0.10 | 2026-11-14 | amarillo | 0 | 11–15–20 | 23–48 | 111 |
| Veintiséis de Octubre | VEINTISEIS DE OCTUBRE (Muy alto) | 0.02 | 2026-11-14 | amarillo | 0 | 11–15–20 | 24–50 | 121 |
| Sullana | SULLANA (Muy alto) | 0.08 | 2026-11-18 | amarillo | 0 | 13–18–23 | 27–58 | 130 |
| Paita | PAITA (Alto) | 0.08 | 2026-11-18 | amarillo | 0 | 10–14–18 | 21–46 | 63 |
| Talara | PARIÑAS (Alto) | 0.12 | 2026-11-15 | amarillo | 0 | 12–15–20 | 23–49 | 66 |

**Cisternas requeridas (escenario condicional rojo, suma de máximos por localidad): 730** — regla del motor: ceil(déficit × 0.15 / (20 m³ × 4 viajes)). Esta cifra alimenta el Nivel 6.

## Semáforo P×I por día

| Localidad | 11-08 | 11-09 | 11-10 | 11-11 | 11-12 | 11-13 | 11-14 | 11-15 | 11-16 | 11-17 | 11-18 | 11-19 | 11-20 | 11-21 | 11-22 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Piura | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama |
| Castilla | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama |
| Veintiséis de Octubre | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama |
| Sullana | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama |
| Paita | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama |
| Talara | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama | ama |

Limitaciones: un solo reservorio agregado por localidad; producción y volúmenes supuestos; la pérdida por probabilidad es un valor esperado, no una trayectoria; Paita/Talara usan el pronóstico del río Chira como proxy de amenaza en la fuente.