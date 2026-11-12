"""Port de web/src/data/escenarios.ts.
DATOS SIMULADOS / SUPUESTOS (volúmenes, producción, dotación, lecturas) hasta obtener datos de EPS Grau.
Conexiones: muestra DS01/DS02 simulada. Coordenadas: centro aproximado de cada ciudad."""
from dataclasses import replace
from semaforo import Amenaza, Localidad, Planta


def _L(id, nombre, lat, lng, planta, cx, dot, vol, prod, pozos, vul, sinred, m5, sinnet, apoyo):
    return Localidad(id, nombre, lat, lng, planta, cx, 4, dot, vol, prod, pozos, vul, sinred, m5, sinnet, apoyo)


BASE = [
    _L("GRAU-01", "Piura", -5.1945, -80.6328, "curumuy", 61797, 150, 60000, 2250, True, 0.45, 10, 21, 20, "Plaza de Armas de Piura"),
    _L("GRAU-02", "Castilla", -5.1990, -80.6080, "curumuy", 25582, 150, 18000, 930, True, 0.62, 15, 24, 27, "Estadio de Castilla"),
    _L("GRAU-05", "Veintiséis de Octubre", -5.1810, -80.6720, "curumuy", 30000, 140, 20000, 1050, True, 0.66, 18, 25, 30, "Parque Central de Veintiséis de Octubre"),
    _L("GRAU-06", "Sullana", -4.9039, -80.6853, "sullana", 31427, 150, 26000, 1150, True, 0.52, 12, 22, 25, "Plaza de Armas de Sullana"),
    _L("GRAU-27", "Paita", -5.0892, -81.1144, "arenal", 15056, 140, 9000, 520, False, 0.58, 14, 23, 28, "Municipalidad de Paita"),
    _L("GRAU-03", "Talara", -4.5772, -81.2719, "arenal", 16400, 140, 11000, 560, False, 0.48, 9, 20, 22, "Municipalidad de Talara"),
]
PLANTAS_BASE = [Planta("curumuy", "PTAP Curumuy", 150), Planta("arenal", "PTAP El Arenal", 120),
                Planta("sullana", "Captación Sullana", 100)]

ESCENARIOS = [
    dict(id="normal", nombre="Temporada normal", amenaza=Amenaza(120, 0, "verde", False),
         plantas={"curumuy": 150, "arenal": 120, "sullana": 100}, lecturas={}),
    dict(id="hoy", nombre="Inicio de lluvias (simulado)", amenaza=Amenaza(950, 35, "naranja", True),
         plantas={"curumuy": 1200, "arenal": 300, "sullana": 400},
         lecturas={"GRAU-02": {"reservorioPct": 55}, "GRAU-05": {"reservorioPct": 60}}),
    dict(id="marzo2023", nombre="Marzo 2023 (réplica simulada)", amenaza=Amenaza(2100, 95, "rojo", True),
         plantas={"curumuy": 3500, "arenal": 900, "sullana": 1500},
         lecturas={"GRAU-01": {"reservorioPct": 45},
                   "GRAU-02": {"reservorioPct": 25, "fallaConfirmada": True, "corteActivoH": 30},
                   "GRAU-06": {"energiaOk": False, "reservorioPct": 40},
                   "GRAU-27": {"reservorioPct": 50}}),
]


def construir_localidades(esc):
    return [replace(b, **esc["lecturas"].get(b.id, {})) for b in BASE]


def construir_plantas(esc):
    return [replace(p, turbiedad=esc["plantas"].get(p.id, p.turbiedad)) for p in PLANTAS_BASE]


def planta_de(loc, plantas):
    return next(p for p in plantas if p.id == loc.plantaId)
