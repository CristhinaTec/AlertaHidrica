# Nivel 7 - Mejora continua (DATOS REALES)

## Registro de pronosticos
Carpetas crudos/: ['2026-11-07']. Filas en registro: 8 (nuevas en esta corrida: 0). Con una sola emision aun no se puede verificar pronostico vs observado; el registro es append-only y se llena en cada corrida del recolector.

## Verificacion retrospectiva de la regla de umbrales (GloFAS reanalisis)
> Cota superior: supone pronostico perfecto. Anticipacion = dias entre el primer cruce del umbral (dentro de ene-jun) y el pico.

| rio   |   anio | fecha_pico   |   caudal_pico | primer_amarillo   |   anticipacion_dias_amarillo |   dias_sobre_amarillo | primer_naranja   |   anticipacion_dias_naranja |   dias_sobre_naranja | primer_rojo   |   anticipacion_dias_rojo |   dias_sobre_rojo |
|:------|-------:|:-------------|--------------:|:------------------|-----------------------------:|----------------------:|:-----------------|----------------------------:|---------------------:|:--------------|-------------------------:|------------------:|
| piura |   1998 | 1998-03-15   |          6169 | 1998-01-01        |                           73 |                   118 | 1998-01-07       |                          67 |                   86 | 1998-01-25    |                       49 |                64 |
| piura |   2017 | 2017-03-10   |          3469 | 2017-03-05        |                            5 |                    34 | 2017-03-05       |                           5 |                   28 | 2017-03-06    |                        4 |                15 |
| piura |   2023 | 2023-03-30   |          1625 | 2023-03-14        |                           16 |                    20 | 2023-03-30       |                           0 |                    7 |               |                      nan |                 0 |
| chira |   1998 | 1998-03-16   |          5199 | 1998-01-01        |                           74 |                    86 | 1998-01-01       |                          74 |                   38 | 1998-02-08    |                       36 |                17 |
| chira |   2017 | 2017-03-27   |          4908 | 2017-01-08        |                           78 |                    69 | 2017-01-14       |                          72 |                   39 | 2017-01-16    |                       70 |                15 |
| chira |   2023 | 2023-02-23   |          3054 | 2023-01-22        |                           32 |                    54 | 2023-02-22       |                           1 |                   18 | 2023-02-23    |                        0 |                 4 |

| rio   |   anios_con_naranja |   anios_con_rojo | anios_naranja_no_nino                                                                                                                          |   anios_evaluados | origen                 |
|:------|--------------------:|-----------------:|:-----------------------------------------------------------------------------------------------------------------------------------------------|------------------:|:-----------------------|
| piura |                   8 |                3 | 2001, 2002, 2008, 2012, 2016                                                                                                                   |                29 | real_glofas_reanalisis |
| chira |                  27 |               16 | 1997, 1999, 2000, 2001, 2002, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2012, 2013, 2014, 2015, 2016, 2018, 2019, 2020, 2021, 2022, 2024, 2025 |                29 | real_glofas_reanalisis |

## Deriva de lluvia (ene-may, 2024-2025 vs 2000-2023)
| id_lugar   |   media_ref |   media_2024_25 |   p95_ref |   p95_2024_25 |   frac_dias_lluvia_ref |   frac_dias_lluvia_2024_25 |   ks_stat |   ks_p | deriva   | temporada   |
|:-----------|------------:|----------------:|----------:|--------------:|-----------------------:|---------------------------:|----------:|-------:|:---------|:------------|
| GRAU-01    |       1.431 |           1.257 |     7.1   |          7.43 |                  0.219 |                      0.182 |     0.041 |  0.714 | no       | ene-may     |
| GRAU-02    |       1.637 |           1.257 |     8.7   |          7.43 |                  0.236 |                      0.182 |     0.059 |  0.272 | no       | ene-may     |
| GRAU-03    |       0.783 |           0.497 |     3.6   |          3.17 |                  0.146 |                      0.086 |     0.092 |  0.017 | no       | ene-may     |
| GRAU-05    |       1.431 |           1.257 |     7.1   |          7.43 |                  0.219 |                      0.182 |     0.041 |  0.714 | no       | ene-may     |
| GRAU-06    |       1.655 |           1.826 |     8.955 |         11.69 |                  0.229 |                      0.254 |     0.042 |  0.676 | no       | ene-may     |
| GRAU-27    |       0.781 |           0.54  |     3.7   |          3.09 |                  0.147 |                      0.106 |     0.065 |  0.179 | no       | ene-may     |