# 6. Informe del proyecto: lo que todo el equipo debe saber

Este documento resume cómo se pensó, diseñó y construyó AlertaHídrica Piura, qué hace cada parte, qué es real y qué falta. Está escrito para que cualquier integrante pueda explicar el sistema ante el jurado, aunque no haya programado esa parte.

---

## 1. La idea en una frase

AlertaHídrica dice **cuántas horas de agua le quedan a cada barrio de Piura y qué hay que hacer antes de que El Niño corte el servicio**.

Los avisos actuales dicen "lloverá". AlertaHídrica dice "Castilla tiene agua para 15 horas: envíe cisternas al hospital".

## 2. Por qué existe

| Lo que pasa hoy | Consecuencia |
|---|---|
| SENAMHI y ENFEN avisan que vienen lluvias | Nadie traduce ese aviso en qué barrio se queda sin agua |
| CAMI YAKU (Sunass) registra los cortes | Se registran cuando ya ocurrieron |
| La planta Curumuy depende de un solo canal | En enero de 2025 una parada dejó sin agua a más de 500 000 personas |
| No hay un protocolo por nivel de riesgo | En 2023 las cisternas pasaron 24 días sin repartir (Contraloría) |

**La decisión que mejoramos:** llenar reservorios, mover cisternas y avisar a las familias antes del corte.

## 3. Cómo se construyó (orden de trabajo)

El historial de GitHub sigue este mismo orden. Cada etapa tiene una etiqueta (`tag`) para saltar directamente a ella.

| Etapa | Etiqueta | Qué se hizo |
|---|---|---|
| 1. Planificación | `etapa-1-planificacion` | Problema, usuarios, investigación, arquitectura, plan de análisis y estilo visual |
| 2. Base y núcleo | `etapa-2-nucleo` | Aplicación base, motor del semáforo, escenarios, mensajes y mapa |
| 3. Datos reales | `etapa-3-datos` | Recolector, pronóstico, automatización y base centralizada |
| 4. Análisis | `etapa-4-analisis` | Los siete niveles, de descriptivo a continuo |
| 5. Aplicación completa | `etapa-5-aplicacion` | Exportación, gráficos, centro de decisión, gemelo, mapa y páginas |
| 6. Documentación | `etapa-6-documentacion` | Este informe |

## 4. Cómo funciona el sistema

```
1. RECOLECTAR         2. CENTRALIZAR          3. ANALIZAR               4. MOSTRAR Y AVISAR
Fuentes públicas  ──► Una sola base     ──►  Siete niveles       ──►  Aplicación web
(26 fuentes)          validada               (de "qué pasó" a          (decisores y
cada 6 horas          286 000 lecturas        "qué hacemos")            ciudadanía)
```

### 4.1 Recolectar (`recolector/`)

Descarga, cada 6 horas, datos de fuentes oficiales y abiertas:

| Tipo | Fuentes |
|---|---|
| Amenaza | Caudal de los ríos Piura y Chira y lluvia a 15 días (GloFAS, ECMWF), temperatura del mar (NOAA), estaciones de SENAMHI |
| Exposición | Riesgo por distrito (CENEPRED), presas y puntos críticos (ANA), hospitales e infraestructura (OpenStreetMap) |
| Salud | Dengue (CDC-MINSA) |

Reglas que no se negocian: el recolector dice quién es en cada consulta, respeta los límites de los servidores, no evade bloqueos y descarta datos personales.

### 4.2 Centralizar (`analisis/00_datos/`)

Todo entra a una sola base (DuckDB) con la misma forma: fecha, lugar, variable, valor, unidad, fuente. Antes de entrar, cada tabla pasa un control de calidad. Si un dato no cumple, se registra y no contamina el análisis.

### 4.3 Analizar: los siete niveles (`analisis/`)

| Nivel | Pregunta | Qué responde hoy | Origen |
|---|---|---|---|
| 1. Descriptivo | ¿Qué pasó? | Lluvia, caudal, riesgo e infraestructura por localidad | Real |
| 2. Correlacional | ¿Qué se mueve junto? | El río responde a la lluvia en 2 a 5 días; el mar avisa con 1 a 8 meses | Real |
| 3. Diagnóstico | ¿Por qué? | Distritos más vulnerables (CENEPRED + OpenStreetMap) | Real; causas de corte en demo |
| 4. Predictivo | ¿Qué pasará y cuándo? | Probabilidad diaria de amenaza a 15 días; probabilidad de corte | Amenaza real; corte en demo |
| 5. Preventivo | ¿Cuánto aguantamos? | Horas de agua por localidad, con rango de incertidumbre | Volúmenes supuestos |
| 6. Prescriptivo | ¿Qué hacemos primero? | Protocolo por color, prioridad de 675 puntos, rutas de cisternas | Propuesta a validar |
| 7. Continuo | ¿Cómo aprende? | Registro de pronósticos y prueba con 1998, 2017 y 2023 | Real |

### 4.4 Mostrar y avisar (`web/`)

| Página | Para quién | Qué permite |
|---|---|---|
| Centro de decisión (portada) | EPS Grau, Sunass, COE | Ver alertas por urgencia, confirmar, escalar y avisar; tareas de 24 h; cisternas |
| Gemelo digital | Operación de la EPS | Seguir el agua del río al hogar y simular "¿y si…?" |
| Mapa | Todos | Riesgo, salud, infraestructura, puntos críticos y rutas |
| Pronóstico | EPS, COE | Probabilidad por día y localidad |
| Análisis | Equipo técnico, jurado | Historia 1984-2025 y resultados de los niveles |
| Datos | Equipo técnico | Ver y descargar cada fuente |
| Hoja de ruta | Jurado, Sunass | Estado de los siete niveles |
| AguaSegura | Hogares | "¿Cómo está el agua en mi zona?", con audio y aviso para reenviar |

**Modo demo:** una banda arriba permite pasar de "Demo: marzo 2023" a "Hoy (datos reales)" y explica qué es real, qué es supuesto y qué es demostración.

## 5. Decisiones de diseño y por qué

| Decisión | Motivo |
|---|---|
| La portada es el centro de decisión, no el mapa | Lo que más impacto tiene es que alguien actúe a tiempo |
| La métrica central son las horas de agua | Es lo que entiende una gerencia y una familia; Aguas Andinas (Chile) ya la usa |
| El semáforo combina probabilidad e impacto | Lluvia fuerte en zona con reservas no es lo mismo que lluvia moderada en zona sin agua |
| Tres rutas para el rojo | Una falla confirmada no espera confirmación; una zona vulnerable sube antes |
| Una persona confirma antes del aviso masivo | Evita falsas alarmas que hagan perder confianza |
| Umbrales en archivos editables | La EPS los calibra sin programar |
| Cada dato dice su origen | Ningún supuesto se presenta como hecho |
| Avisos por SMS, radio y promotoras | El 24 % de hogares de la muestra no tiene internet |
| Mensajes dirigidos a las mujeres | Cargan el agua en el 61 % de los hogares sin servicio (INEI) |

## 6. Lo que es real, lo que es supuesto y lo que falta

| Real hoy | Supuesto hoy | Falta para producción |
|---|---|---|
| Pronósticos de caudal y lluvia | Volumen de reservorios | Datos de EPS Grau (solicitud por Ley N.º 27806) |
| Temperatura del mar | Producción de cada planta | Excel del expediente (DS01-DS08) |
| Riesgo por distrito | Turbiedad | Sensores de turbiedad y nivel en el piloto |
| Hospitales, estaciones, presas | Flota de cisternas | Umbrales oficiales del río Chira |
| Historia 1984-2025 | | Validar el protocolo con EPS Grau, COE y DIRESA |

**Hallazgo que justifica los sensores:** con datos reales, la regla del río habría avisado de 1998 con 67 días, pero de 2017 solo con 4 a 5. En eventos rápidos el río avisa tarde; medir turbiedad y reservorios da las horas que faltan.

## 7. Variables que más importan y cómo medirlas

| Variable | Hoy | Propuesta |
|---|---|---|
| Nivel de reservorios | No se mide públicamente | Sensor de nivel en cada reservorio (prioridad 1) |
| Turbiedad del agua cruda | Solo satélite cada 5 días | Sensor óptico en Curumuy y El Arenal (prioridad 1) |
| Producción de planta | No | Caudalímetro de salida (prioridad 2) |
| Energía en pozos | Solo cortes programados | Detector de tensión (prioridad 2) |
| Canal Daniel Escobar / Poechos | Parcial (ANA) | Sensor de nivel si no se publica (prioridad 2) |
| Lluvia y caudal | Sí (SENAMHI, GloFAS) | No hace falta duplicar |

El detalle de las nueve variables está en `analisis/salidas/variables_significativas.md`.

## 8. Cómo usarlo

```bash
# 1. Recolectar y pronosticar
cd recolector && pip install -r requirements.txt
python recolectar_todo.py && python pronostico.py

# 2. Centralizar, analizar y exportar
cd ../analisis
python 00_datos/centralizar.py
python exportar_web.py

# 3. Ver la aplicación
cd ../web && npm install && npm run dev     # http://localhost:5173
```

Pruebas del motor: `cd analisis/05_preventivo && python -m pytest -q tests` (19 pruebas).

Para cambiar umbrales: `analisis/reglas.yaml` y `web/src/config/reglas.ts`. Para cambiar el protocolo: `analisis/protocolo.yaml`.

## 9. Quién hace qué

| Rol | Responsable sugerida | Tareas |
|---|---|---|
| Datos y modelo | Programadora 1 | Recolector, base, niveles 1 a 4, validación 2017/2023 |
| Interfaz | Programadora 2 | Aplicación, centro de decisión, vista ciudadana |
| Riesgo y salud | Ingeniera ambiental | Umbrales, protocolo, mensajes sanitarios, revisión del índice |
| Hidrología y territorio | Ingeniera agrícola | Cuenca, Poechos, ubicación de sensores, revisión de desfases |

## 10. Documentación que existe y la que falta

| Documento | Estado |
|---|---|
| README del repositorio | Listo |
| Problema y objetivos, investigación, arquitectura, plan de análisis, estilo visual | Listos (`docs/01` a `docs/05`) |
| Este informe | Listo |
| Documento técnico de 2 páginas (fase 2) | Listo (falta el nombre de la líder) |
| Expediente de investigación con 46 referencias | Listo (documento del equipo) |
| **Guion del video de 3 minutos** | Falta |
| **Manual de uso para la analista de la EPS** (paso a paso con capturas) | Falta; necesario para la fase 5 |
| **Diccionario de datos** (cada tabla y columna, unidad y fuente) | Parcial en `analisis/00_datos/README.md` |
| **Protocolo por color validado** con EPS Grau, COE y DIRESA | Borrador en `analisis/protocolo.yaml` |
| **Licencia del código** | Falta decidir; las bases dan a Sunass una licencia no exclusiva |
| **Guía de mantenimiento** (cómo actualizar fuentes y umbrales) | Falta; necesaria para la transferencia |
| **Presentación para el sprint** | Falta |

## 11. Riesgos y cómo los manejamos

| Riesgo | Cómo se maneja |
|---|---|
| Datos simulados con resultados optimistas | Se declara en cada pantalla y documento |
| Falsas alarmas | Causa visible, confirmación humana, umbrales calibrables |
| Una fuente deja de responder | Fuente de respaldo y aviso de confianza baja |
| Privacidad | Avisos por zona, suscripción voluntaria, sin datos personales |
| Dependencia de servicios gratuitos | Formatos estándar, migrables a servidores de Sunass |
