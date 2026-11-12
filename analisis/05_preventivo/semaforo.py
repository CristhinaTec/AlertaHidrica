"""Port fiel de web/src/lib/semaforo.ts. Reglas en ../reglas.yaml (mismos valores que reglas.ts)."""
from __future__ import annotations
import math
from dataclasses import dataclass
from pathlib import Path
import yaml

REGLAS_PATH = Path(__file__).resolve().parents[1] / "reglas.yaml"
ORDEN = ["verde", "amarillo", "naranja", "rojo"]


def cargar_reglas(path: Path = REGLAS_PATH) -> dict:
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


R = cargar_reglas()


def _max(a: str, b: str) -> str:
    return a if ORDEN.index(a) >= ORDEN.index(b) else b


@dataclass
class Amenaza:
    caudalSanchezCerro: float
    lluvia24h: float
    avisoSenamhi: str
    alertaEnfen: bool


@dataclass
class Planta:
    id: str
    nombre: str
    turbiedad: float


@dataclass
class Localidad:
    id: str
    nombre: str
    lat: float
    lng: float
    plantaId: str
    conexiones: int
    personasPorConexion: float
    dotacionLhd: float
    volumenReservoriosM3: float
    produccionM3h: float
    dependePozos: bool
    vulnerabilidad: float
    hogaresSinRedPct: float
    menores5Pct: float
    sinInternetPct: float
    puntoApoyo: str
    reservorioPct: float = 90
    energiaOk: bool = True
    corteActivoH: float = 0
    fallaConfirmada: bool = False


def acciones_para(nivel: str) -> list[str]:
    return {
        "verde": ["Monitoreo normal", "Mantenimiento preventivo"],
        "amarillo": ["Verificar niveles de reservorios", "Revisar el plan de contingencia",
                     "Recomendar guardar agua en recipientes tapados"],
        "naranja": ["Preposicionar cisternas", "Llenar reservorios al máximo",
                    "Avisar a hogares vulnerables y centros de salud", "Reforzar control de calidad del agua"],
        "rojo": ["Activar puntos de reparto de agua segura", "Despachar cisternas: hospitales primero",
                 "Coordinar con COE, INDECI y DIRESA", "Emitir alerta ciudadana (SISMATE vía COE)"],
    }[nivel]


def demanda_m3h(loc: Localidad, R: dict = R) -> float:
    return loc.conexiones * loc.personasPorConexion * loc.dotacionLhd / 1000 / 24 * (1 + R["perdidasRed"])


def evaluar(loc: Localidad, planta: Planta, a: Amenaza, R: dict = R) -> dict:
    causas: list[str] = []
    poblacion = loc.conexiones * loc.personasPorConexion
    dem = demanda_m3h(loc, R)

    # 1. Producción disponible según turbiedad y energía
    factor = 1.0
    if planta.turbiedad >= R["turbiedad"]["critica"]:
        factor -= R["perdidaProduccion"]["turbiedadCritica"]
    elif planta.turbiedad >= R["turbiedad"]["alta"]:
        factor -= R["perdidaProduccion"]["turbiedadAlta"]
    if not loc.energiaOk and loc.dependePozos:
        factor -= R["perdidaProduccion"]["sinEnergia"]
    if loc.fallaConfirmada:
        factor = 0
    produccion = loc.produccionM3h * max(0, factor)

    # 2. Autonomía
    almacenado = loc.volumenReservoriosM3 * (loc.reservorioPct / 100)
    faltante = dem - produccion
    autonomia_h = math.inf if faltante <= 0 else almacenado / faltante

    # 3. Duración probable del corte
    D = R["duracionCorteH"]
    corte = loc.corteActivoH
    if a.caudalSanchezCerro >= R["caudal"]["rojo"]:
        corte = max(corte, D["captacion"])
    if planta.turbiedad >= R["turbiedad"]["critica"]:
        corte = max(corte, D["turbiedad"])
    if loc.fallaConfirmada:
        corte = max(corte, D["linea"])
    if not loc.energiaOk:
        corte = max(corte, D["energia"])

    aut_f = autonomia_h if math.isfinite(autonomia_h) else 9999
    deficit_h = max(0, corte - aut_f)
    deficit_m3 = deficit_h * dem
    C = R["cisterna"]
    cisternas = math.ceil((deficit_m3 * C["fraccionPrioritaria"]) / (C["capacidadM3"] * C["viajesPorDia"]))

    # 4. Nivel por tres rutas
    nivel, ruta = "verde", "Condiciones normales"
    A_ = R["autonomiaH"]
    if a.alertaEnfen:
        nivel = _max(nivel, "amarillo"); causas.append("Alerta ENFEN vigente")
    if a.caudalSanchezCerro >= R["caudal"]["amarillo"]:
        nivel = _max(nivel, "amarillo"); causas.append(f"Río Piura en {a.caudalSanchezCerro:g} m³/s")
    if a.avisoSenamhi == "amarillo":
        nivel = _max(nivel, "amarillo"); causas.append("Aviso amarillo de SENAMHI")
    if aut_f < A_["amarillo"] and corte > 0:
        nivel = _max(nivel, "amarillo")

    amenaza_alta = (a.caudalSanchezCerro >= R["caudal"]["naranja"] or a.lluvia24h >= R["lluvia24h"]["naranja"]
                    or a.avisoSenamhi in ("naranja", "rojo"))
    if amenaza_alta:
        nivel = _max(nivel, "naranja"); ruta = "Amenaza alta pronosticada"
    if a.lluvia24h >= R["lluvia24h"]["naranja"]:
        causas.append(f"Lluvia de {a.lluvia24h:g} mm en 24 h")
    if a.avisoSenamhi in ("naranja", "rojo"):
        causas.append(f"Aviso {a.avisoSenamhi} de SENAMHI")
    if planta.turbiedad >= R["turbiedad"]["alta"]:
        nivel = _max(nivel, "naranja"); causas.append(f"Turbiedad de {planta.turbiedad:g} NTU en {planta.nombre}")
    if aut_f < A_["naranja"] and corte > 0:
        nivel = _max(nivel, "naranja")
    if nivel == "amarillo" and loc.vulnerabilidad >= R["vulnerabilidadAlta"]:
        nivel = "naranja"; ruta = "Naranja preventivo por vulnerabilidad alta"; causas.append("Zona de vulnerabilidad alta")
    if not loc.energiaOk:
        causas.append("Corte de energía en pozos o bombeo")
    if loc.reservorioPct < R["reservorioCriticoPct"]:
        causas.append(f"Reservorio al {loc.reservorioPct:g} %")

    sensor_critico = (planta.turbiedad >= R["turbiedad"]["alta"] or loc.reservorioPct < R["reservorioCriticoPct"]
                      or not loc.energiaOk)
    if (a.caudalSanchezCerro >= R["caudal"]["rojo"] or a.avisoSenamhi == "rojo") and sensor_critico:
        nivel = "rojo"; ruta = "Rojo anticipado: pronóstico severo + sensor crítico"
    if aut_f < A_["rojo"] and corte > aut_f:
        nivel = "rojo"; ruta = "Rojo anticipado: menos de 24 h de agua"
    if loc.fallaConfirmada or loc.corteActivoH > 24 or planta.turbiedad >= R["turbiedad"]["critica"]:
        nivel = "rojo"; ruta = "Rojo inmediato: falla confirmada"
        if loc.fallaConfirmada:
            causas.append("Falla confirmada en la infraestructura")
        if loc.corteActivoH > 24:
            causas.append(f"Corte activo de {loc.corteActivoH:g} h")
    if nivel != "verde" and ruta == "Condiciones normales":
        ruta = "Señales de riesgo en aumento"

    return dict(nivel=nivel, ruta=ruta, causas=list(dict.fromkeys(causas)), autonomiaH=autonomia_h,
                corteEstimadoH=corte, deficitH=deficit_h, deficitM3=deficit_m3, cisternas=cisternas,
                poblacion=poblacion, demandaM3h=dem, acciones=acciones_para(nivel),
                confianza="media" if loc.volumenReservoriosM3 > 0 else "baja")
