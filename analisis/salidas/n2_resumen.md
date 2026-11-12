# Nivel 2 - Analisis correlacional (AlertaHidrica Piura)

Datos reales: Open-Meteo (lluvia diaria 2000-2025), GloFAS (caudal diario 1984-2025; rio Piura x1.35), NOAA (Nino 1+2 semanal interpolado a diario, ONI). Los datos de cortes de agua del expediente NO estaban disponibles; este nivel no mide cortes.

## 1. ENSO -> lluvia / caudal mensual (Spearman, mejor desfase 0-6 meses)
- nino12_anom -> caudal_chira_max (mensual): rho(0)=0.13; max rho=0.13 en desfase 0 meses (p=0.016, n=348)
- nino12_anom -> caudal_piura_max (mensual): rho(0)=0.19; max rho=0.19 en desfase 0 meses (p=0.00051, n=348)
- nino12_anom -> lluvia_Piura (mensual): rho(0)=0.10; max rho=0.10 en desfase 0 meses (p=0.068, n=312)
- nino12_anom -> lluvia_Sullana (mensual): rho(0)=0.10; max rho=0.10 en desfase 0 meses (p=0.088, n=312)
- nino34_anom -> caudal_chira_max (mensual): rho(0)=0.00; max rho=0.05 en desfase 6 meses (p=0.4, n=348)
- nino34_anom -> caudal_piura_max (mensual): rho(0)=0.00; max rho=0.00 en desfase 0 meses (p=0.96, n=348)
- nino34_anom -> lluvia_Piura (mensual): rho(0)=-0.08; max rho=0.00 en desfase 6 meses (p=0.97, n=312)
- nino34_anom -> lluvia_Sullana (mensual): rho(0)=-0.08; max rho=0.02 en desfase 6 meses (p=0.79, n=312)
- oni -> caudal_chira_max (mensual): rho(0)=0.04; max rho=0.04 en desfase 0 meses (p=0.49, n=348)
- oni -> caudal_piura_max (mensual): rho(0)=0.05; max rho=0.05 en desfase 0 meses (p=0.39, n=348)
- oni -> lluvia_Piura (mensual): rho(0)=-0.04; max rho=-0.04 en desfase 0 meses (p=0.44, n=312)
- oni -> lluvia_Sullana (mensual): rho(0)=-0.05; max rho=-0.03 en desfase 6 meses (p=0.57, n=312)

## 2. Tiempo de respuesta lluvia -> caudal (dias)
- [lluvia->caudal (ene-may)] lluvia_Piura acum 1d -> caudal_piura: max rho=0.44 en desfase 4 d (rho d0=0.34)
- [lluvia->caudal (ene-may)] lluvia_Piura acum 3d -> caudal_piura: max rho=0.54 en desfase 3 d (rho d0=0.47)
- [lluvia->caudal (ene-may)] lluvia_Piura acum 7d -> caudal_piura: max rho=0.63 en desfase 2 d (rho d0=0.60)
- [lluvia->caudal (ene-may)] lluvia_Sullana acum 1d -> caudal_chira: max rho=0.58 en desfase 2 d (rho d0=0.47)
- [lluvia->caudal (ene-may)] lluvia_Sullana acum 3d -> caudal_chira: max rho=0.68 en desfase 1 d (rho d0=0.65)
- [lluvia->caudal (ene-may)] lluvia_Sullana acum 7d -> caudal_chira: max rho=0.71 en desfase 0 d (rho d0=0.71)
- [lluvia->caudal (todo)] lluvia_Piura acum 1d -> caudal_piura: max rho=0.41 en desfase 5 d (rho d0=0.34)
- [lluvia->caudal (todo)] lluvia_Piura acum 3d -> caudal_piura: max rho=0.50 en desfase 4 d (rho d0=0.45)
- [lluvia->caudal (todo)] lluvia_Piura acum 7d -> caudal_piura: max rho=0.57 en desfase 3 d (rho d0=0.54)
- [lluvia->caudal (todo)] lluvia_Sullana acum 1d -> caudal_chira: max rho=0.54 en desfase 2 d (rho d0=0.48)
- [lluvia->caudal (todo)] lluvia_Sullana acum 3d -> caudal_chira: max rho=0.65 en desfase 1 d (rho d0=0.63)
- [lluvia->caudal (todo)] lluvia_Sullana acum 7d -> caudal_chira: max rho=0.72 en desfase 0 d (rho d0=0.72)
- CCF Pearson log(caudal Piura) vs lluvia diaria Piura: pico en desfase 5 d (r=0.34).

## 3. El Nino costero (1998, 2017, 2023; feb-abr) vs resto (Mann-Whitney unilateral)
- lluvia_Piura FMA (sum): mediana Nino=878.0 (anios 2017,2023) vs resto=107.5 (n=24); U=48.0, p=0.00308
- lluvia_Sullana FMA (sum): mediana Nino=985.7 (anios 2017,2023) vs resto=123.5 (n=24); U=48.0, p=0.00308
- caudal_piura FMA (max): mediana Nino=3468.7 (anios 1998,2017,2023) vs resto=528.2 (n=26); U=74.0, p=0.00301
- caudal_chira FMA (max): mediana Nino=4908.1 (anios 1998,2017,2023) vs resto=2731.1 (n=26); U=72.5, p=0.00905

Dias por anio con caudal Piura calibrado sobre umbral (solo anios con algun dia > 900):

| Anio | >900 | >1290 | >1900 | Caudal max |
|---|---|---|---|---|
| 1997 | 6 | 0 | 0 | 1183 |
| 1998 | 118 | 86 | 64 | 6169 |
| 2001 | 21 | 11 | 0 | 1690 |
| 2002 | 23 | 10 | 0 | 1862 |
| 2008 | 15 | 4 | 0 | 1742 |
| 2012 | 13 | 2 | 0 | 1459 |
| 2016 | 6 | 5 | 1 | 1950 |
| 2017 | 34 | 28 | 15 | 3469 |
| 2023 | 20 | 7 | 0 | 1625 |
| 2025 | 4 | 0 | 0 | 1169 |

## 4. Alerta temprana: Nino 1+2 > umbral precede caudal Piura > 1290 m3/s
Anio hidrologico jul-jun. Acierto = alerta (Nino1+2 > umbral en algun dia del anio hidrologico, a mas tardar el primer dia > 1290). Fecha de alerta = inicio de la racha continua sobre el umbral (puede ser anterior a julio). Falsa alarma = anio con alerta y sin caudal > 1290.

- Nino1+2 > +1 °C: aciertos=5.0, eventos no anticipados=3.0, falsas alarmas=12.0, sin alerta ni evento=8.0; POD=0.62, FAR=0.71
- Nino1+2 > +2 °C: aciertos=3.0, eventos no anticipados=5.0, falsas alarmas=3.0, sin alerta ni evento=17.0; POD=0.38, FAR=0.50

Anticipacion por evento:

- 1997-1998 (umbral +1): alerta 1997-04-25, caudal>1290 desde 1998-01-07, anticipacion=257 d (8.4 meses), 86 dias >1290, Qmax=6169.3 -> acierto
- 2000-2001 (umbral +1): alerta 2001-03-21, caudal>1290 desde 2001-03-17, anticipacion=NA d (NA meses), 11 dias >1290, Qmax=1690.4 -> evento no anticipado
- 2001-2002 (umbral +1): alerta 2002-03-13, caudal>1290 desde 2002-03-24, anticipacion=11 d (0.4 meses), 10 dias >1290, Qmax=1862.2 -> acierto
- 2007-2008 (umbral +1): alerta None, caudal>1290 desde 2008-03-18, anticipacion=NA d (NA meses), 4 dias >1290, Qmax=1741.8 -> evento no anticipado
- 2011-2012 (umbral +1): alerta 2012-04-14, caudal>1290 desde 2012-03-24, anticipacion=NA d (NA meses), 2 dias >1290, Qmax=1458.6 -> evento no anticipado
- 2015-2016 (umbral +1): alerta 2015-04-16, caudal>1290 desde 2016-03-07, anticipacion=326 d (10.7 meses), 5 dias >1290, Qmax=1950.0 -> acierto
- 2016-2017 (umbral +1): alerta 2017-01-16, caudal>1290 desde 2017-03-05, anticipacion=48 d (1.6 meses), 28 dias >1290, Qmax=3468.7 -> acierto
- 2022-2023 (umbral +1): alerta 2023-03-01, caudal>1290 desde 2023-03-30, anticipacion=29 d (1.0 meses), 7 dias >1290, Qmax=1625.5 -> acierto
- 1997-1998 (umbral +2): alerta 1997-05-17, caudal>1290 desde 1998-01-07, anticipacion=235 d (7.7 meses), 86 dias >1290, Qmax=6169.3 -> acierto
- 2000-2001 (umbral +2): alerta None, caudal>1290 desde 2001-03-17, anticipacion=NA d (NA meses), 11 dias >1290, Qmax=1690.4 -> evento no anticipado
- 2001-2002 (umbral +2): alerta None, caudal>1290 desde 2002-03-24, anticipacion=NA d (NA meses), 10 dias >1290, Qmax=1862.2 -> evento no anticipado
- 2007-2008 (umbral +2): alerta None, caudal>1290 desde 2008-03-18, anticipacion=NA d (NA meses), 4 dias >1290, Qmax=1741.8 -> evento no anticipado
- 2011-2012 (umbral +2): alerta None, caudal>1290 desde 2012-03-24, anticipacion=NA d (NA meses), 2 dias >1290, Qmax=1458.6 -> evento no anticipado
- 2015-2016 (umbral +2): alerta 2015-06-18, caudal>1290 desde 2016-03-07, anticipacion=263 d (8.6 meses), 5 dias >1290, Qmax=1950.0 -> acierto
- 2016-2017 (umbral +2): alerta 2017-03-11, caudal>1290 desde 2017-03-05, anticipacion=NA d (NA meses), 28 dias >1290, Qmax=3468.7 -> evento no anticipado
- 2022-2023 (umbral +2): alerta 2023-03-30, caudal>1290 desde 2023-03-30, anticipacion=0 d (0.0 meses), 7 dias >1290, Qmax=1625.5 -> acierto
- Falsas alarmas con +1 °C: 1998-1999, 2002-2003, 2004-2005, 2005-2006, 2006-2007, 2008-2009, 2009-2010, 2013-2014, 2014-2015, 2018-2019, 2023-2024, 2024-2025
- Falsas alarmas con +2 °C: 2006-2007, 2014-2015, 2023-2024

## Advertencias
- Correlacion no es causalidad; hay muy pocos eventos extremos, las metricas de alerta son indicativas.
- GloFAS es un MODELO hidrologico (reanalisis), no observacion de estacion; suele subestimar picos.
- La calibracion x1.35 se derivo de un solo evento; los conteos sobre umbrales son sensibles a ese factor.
- Open-Meteo es reanalisis grillado (no pluviometro) y cubre 2000-2025: 1998 no entra en las comparaciones de lluvia.
- DATOS: 03_datos/externos/noaa/nino_semanal.csv esta incompleto (628 de ~2360 semanas; se perdieron las semanas con anomalias negativas pegadas, p.ej. '24.1-0.2'), lo que lo sesga hacia El Nino. Este analisis usa el archivo oficial CPC wksst9120.for (base 1991-2020). Corregir el parser del recolector historico.
- Nino 1+2 semanal interpolado a diario; las fechas de alerta tienen resolucion efectiva semanal.
- Este nivel no mide cortes de agua: el vinculo caudal -> corte requiere los datos del expediente.