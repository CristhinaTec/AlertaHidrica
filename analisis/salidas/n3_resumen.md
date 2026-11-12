# Nivel 3 - Diagnostico

## A. Cortes y componentes (DEMO-SINTETICO: muestra el flujo; NO es hallazgo sobre EPS Grau)

Pareto de causas (horas de corte):
| causa                     |   eventos |   horas |   pct_horas |   pct_acum | origen         |
|:--------------------------|----------:|--------:|------------:|-----------:|:---------------|
| turbiedad alta            |        65 |  7392.9 |        26   |       26   | demo_sintetico |
| rotura por huaico/erosion |        49 |  6799.5 |        23.9 |       49.9 | demo_sintetico |
| mantenimiento             |       103 |  5245.5 |        18.4 |       68.3 | demo_sintetico |
| rotura por antiguedad     |        69 |  3491.2 |        12.3 |       80.6 | demo_sintetico |
| corte electrico           |        53 |  3388.8 |        11.9 |       92.5 | demo_sintetico |
| inundacion de equipo      |        13 |  2143   |         7.5 |      100   | demo_sintetico |

IV por componente vs regresion logistica (y = componente con algun corte >=72 h):
| variable       |   peso_IV |   coef_logit_std |   peso_logit_normalizado | origen         |
|:---------------|----------:|-----------------:|-------------------------:|:---------------|
| exposicion     |      0.3  |            0.578 |                    0.283 | demo_sintetico |
| cruce_quebrada |      0.25 |            0.696 |                    0.341 | demo_sintetico |
| sin_generador  |      0.2  |            0.458 |                    0.225 | demo_sintetico |
| antiguedad_n   |      0.15 |            0.309 |                    0.151 | demo_sintetico |
| estado_n       |      0.1  |           -0.041 |                    0     | demo_sintetico |

- AUC IV=0.74; AUC logistica (in-sample)=0.76; Spearman IV vs n cortes>=72h=0.47; n componentes=120
- En modo demo el generador usa IV^2 para elegir el componente, asi que la concordancia es esperada por construccion: solo valida que el pipeline recupera la senal. Con DS02/DS03 reales esta tabla dira si los pesos .30/.25/.20/.15/.10 se sostienen.

## B. Vulnerabilidad territorial REAL (CENEPRED + OSM)

IVT = .35 riesgo inundacion + .25 pobreza monetaria + .15 % EESS expuestos + .15 % viviendas expuestas + .10 infra. agua OSM a 5 km (pesos supuestos; datos reales).

| nombprov   | nombdist              |   pob_2017 | nriesgo_in   |   pobrmo |   eess_sinu |   infra_agua_osm_5km |   IVT |
|:-----------|:----------------------|-----------:|:-------------|---------:|------------:|---------------------:|------:|
| PIURA      | LA ARENA              |      38734 | Muy alto     |     38.1 |          10 |                    6 | 0.817 |
| PIURA      | EL TALLAN             |       5387 | Muy alto     |     40.7 |           2 |                    3 | 0.807 |
| PIURA      | TAMBO GRANDE          |     107199 | Muy alto     |     38.1 |          35 |                    2 | 0.788 |
| PAITA      | COLAN                 |      14869 | Muy alto     |     29.2 |           3 |                    7 | 0.787 |
| PIURA      | VEINTISEIS DE OCTUBRE |     165779 | Muy alto     |     16.3 |          83 |                   14 | 0.782 |
| SULLANA    | BELLAVISTA            |      37530 | Muy alto     |     19.4 |           2 |                   12 | 0.781 |
| MORROPON   | SALITRAL              |       8527 | Muy alto     |     40.1 |           4 |                    0 | 0.777 |
| MORROPON   | LA MATANZA            |      13997 | Muy alto     |     38.7 |           5 |                    0 | 0.777 |
| PIURA      | CURA MORI             |      18671 | Muy alto     |     31.9 |           4 |                    2 | 0.762 |
| SECHURA    | BERNAL                |       6855 | Muy alto     |     33.4 |           3 |                    1 | 0.762 |
| SECHURA    | CRISTO NOS VALGA      |       4300 | Muy alto     |     34.5 |           2 |                    0 | 0.759 |
| SECHURA    | VICE                  |      15630 | Muy alto     |     33.4 |           9 |                    0 | 0.754 |
| PAITA      | VICHAYAL              |       5622 | Muy alto     |     29.2 |           2 |                    2 | 0.751 |
| PIURA      | LA UNION              |      41742 | Muy alto     |     31.9 |           6 |                    0 | 0.748 |
| PIURA      | CATACAOS              |      75870 | Muy alto     |     31.9 |          20 |                    0 | 0.748 |