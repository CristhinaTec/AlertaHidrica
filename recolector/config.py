"""Configuración del recolector de AlertaHídrica Piura.

Cada fuente nueva se agrega aquí y en fuentes.py. Los umbrales viven en un solo lugar
para que la EPS los calibre sin tocar el código.
"""
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]          # carpeta SUNASS/
DATOS_CRUDOS = RAIZ / "03_datos" / "externos" / "crudos"
SALIDA_WEB = RAIZ / "04_desarrollo" / "web" / "public" / "data"

# Celdas GloFAS sobre el cauce (halladas buscando la celda con mayor caudal en marzo de 2023).
RIOS = {
    "piura": {"nombre": "Río Piura (Sánchez Cerro)", "lat": -5.19, "lon": -80.68,
              # Factor = caudal observado 2017 (3 468 m³/s, LACCEI 2020) / pico GloFAS 2017 (2 569 m³/s).
              # Calibración con UN solo evento: aproximada, a mejorar con la serie de SENAMHI.
              "factor_calibracion": 3468 / 2569,
              # Umbrales de SENAMHI/COER en Sánchez Cerro (prensa; por confirmar vigencia 2026).
              "umbrales": {"amarillo": 900, "naranja": 1290, "rojo": 1900},
              "tipo_umbral": "SENAMHI (m³/s observados)"},
    "chira": {"nombre": "Río Chira (Sullana)", "lat": -4.85, "lon": -80.69,
              "factor_calibracion": 1.0,
              # Sin umbrales oficiales verificados: se usan percentiles de la climatología GloFAS 2000-2025.
              "umbrales": None, "percentiles": {"amarillo": 0.90, "naranja": 0.97, "rojo": 0.995},
              "tipo_umbral": "Percentiles GloFAS 2000-2025"},
}

LOCALIDADES = [
    {"id": "GRAU-01", "nombre": "Piura", "lat": -5.1945, "lon": -80.6328, "rio": "piura"},
    {"id": "GRAU-02", "nombre": "Castilla", "lat": -5.1990, "lon": -80.6080, "rio": "piura"},
    {"id": "GRAU-05", "nombre": "Veintiséis de Octubre", "lat": -5.1810, "lon": -80.6720, "rio": "piura"},
    {"id": "GRAU-06", "nombre": "Sullana", "lat": -4.9039, "lon": -80.6853, "rio": "chira"},
    {"id": "GRAU-27", "nombre": "Paita", "lat": -5.0892, "lon": -81.1144, "rio": "chira"},
    {"id": "GRAU-03", "nombre": "Talara", "lat": -4.5772, "lon": -81.2719, "rio": "chira"},
]

# Lluvia diaria (mm) para la probabilidad de lluvia intensa. Supuesto inicial, calibrable.
LLUVIA_UMBRALES = {"amarillo": 20, "naranja": 40, "rojo": 80}

# Un nivel se asigna a un día si su probabilidad alcanza este valor (decisión de la EPS).
PROB_DECISION = 0.30

# Estado ENFEN: se actualiza a mano con cada comunicado (PDF sin API).
ENFEN = {"comunicado": "N.º 19-2026", "fecha": "2026-10-30", "estado": "Alerta de El Niño costero",
         "magnitud": "Extraordinaria en Niño 1+2 hasta febrero de 2027",
         "url": "https://enfen.imarpe.gob.pe/2026/10/30/comunicado-oficial-enfen-n19-2026"}

DIAS_PRONOSTICO = 15
