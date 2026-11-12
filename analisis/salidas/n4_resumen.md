# Nivel 4 - Modelo de falla (corte >= 72 h en localidad-mes)

> **DEMOSTRACION DEL METODO, no precision real (objetivo demo_sintetico)**

Panel 720 localidad-mes 2016-2025; tasa base y=1: 0.12. X reales (ERA5, GloFAS, NOAA) + IV demo.

## Validacion temporal
|   prueba | metodo        |   n |   eventos |   brier |   auc |   POD |   FAR | origen_objetivo   |
|---------:|:--------------|----:|----------:|--------:|------:|------:|------:|:------------------|
|     2017 | logistica     |  72 |        20 |   0.114 | 0.787 | 0.7   | 0.263 | demo_sintetico    |
|     2017 | regla_feb_mar |  72 |        20 |   0.139 | 0.765 | 0.55  | 0.083 | demo_sintetico    |
|     2017 | lightgbm      |  72 |        20 |   0.112 | 0.786 | 0.65  | 0.235 | demo_sintetico    |
|     2023 | logistica     |  72 |        16 |   0.085 | 0.848 | 0.75  | 0.25  | demo_sintetico    |
|     2023 | regla_feb_mar |  72 |        16 |   0.25  | 0.594 | 0.312 | 0.583 | demo_sintetico    |
|     2023 | lightgbm      |  72 |        16 |   0.091 | 0.836 | 0.688 | 0.389 | demo_sintetico    |

## Importancia (permutacion, Brier) - modelo logistico final
| variable       |   importancia_perm_brier |     sd |   coef_logit_std | tipo_dato_X    | origen_objetivo   | rotulo                                                               |
|:---------------|-------------------------:|-------:|-----------------:|:---------------|:------------------|:---------------------------------------------------------------------|
| lluvia_max_dia |                   0.0299 | 0.0031 |           0.8055 | real           | demo_sintetico    | DEMOSTRACION DEL METODO, no precision real (objetivo demo_sintetico) |
| nino12_lag2    |                   0.007  | 0.0013 |          -0.4927 | real           | demo_sintetico    | DEMOSTRACION DEL METODO, no precision real (objetivo demo_sintetico) |
| nino12_lag1    |                   0.0035 | 0.0009 |           0.3935 | real           | demo_sintetico    | DEMOSTRACION DEL METODO, no precision real (objetivo demo_sintetico) |
| nino12_lag0    |                   0.0024 | 0.0007 |           0.3216 | real           | demo_sintetico    | DEMOSTRACION DEL METODO, no precision real (objetivo demo_sintetico) |
| log_caudal_max |                   0.0018 | 0.0007 |           0.2836 | real           | demo_sintetico    | DEMOSTRACION DEL METODO, no precision real (objetivo demo_sintetico) |
| log_lluvia_mes |                   0.0002 | 0.0002 |           0.0841 | real           | demo_sintetico    | DEMOSTRACION DEL METODO, no precision real (objetivo demo_sintetico) |
| iv_loc         |                   0      | 0      |           0.0163 | demo_sintetico | demo_sintetico    | DEMOSTRACION DEL METODO, no precision real (objetivo demo_sintetico) |

## Aplicacion al pronostico actual (2026-11-08T04:50:58+00:00)
| localidad             |   p_max |
|:----------------------|--------:|
| Piura                 |   0.649 |
| Castilla              |   0.785 |
| Veintiséis de Octubre |   0.644 |
| Sullana               |   0.771 |
| Paita                 |   0.659 |
| Talara                |   0.863 |

Limitaciones: el objetivo se genero a partir de lluvia/caudal reales, por eso las metricas son optimistas por construccion; el Nino 1+2 actual (+5.4 C) esta fuera del rango de entrenamiento 2016-2025 salvo 2017/2023 (extrapolacion).