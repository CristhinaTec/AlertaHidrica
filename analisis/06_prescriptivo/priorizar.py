"""Nivel 6 (Prescriptivo): prioridad de puntos de atención, asignación voraz de cisternas y ruteo (VRP).

Datos reales: OSM (piura_infraestructura.json), CENEPRED (riesgo inundación por distrito; IPRESS afectadas COEN/COESALUD).
SUPUESTOS: demanda diaria por punto, flota (derivada de n5 con datos EPS supuestos), una sola base en Piura.

Puntaje (0-100):
  60 × peso_tipo   (hospital 1.0, clínica 1.0, IPRESS COESALUD 0.9, consultorio 0.6, colegio/albergue 0.4)
+ 15 × riesgo distrito (niv_sinu: Muy alto 1, Alto .75, Medio .5, Bajo .25, Muy bajo 0)
+ 15 × pobreza distrito / máx pobreza de los distritos atendidos
+ 10 si el punto es IPRESS afectada en temporada de lluvias previa (COESALUD)
Asignación voraz: por puntaje descendente, se asigna la demanda diaria del punto hasta agotar la capacidad
= cisternas (n5) × 20 m³ × 4 viajes/día.
"""
from __future__ import annotations
import csv
import json
import math
import sys
from pathlib import Path

import yaml

AQUI = Path(__file__).resolve().parent
ANALISIS = AQUI.parent
RAIZ = ANALISIS.parents[1]
sys.path.insert(0, str(ANALISIS / "05_preventivo"))
from escenarios import BASE  # noqa: E402
from gemelo import UBIGEO, cargar_cenepred  # noqa: E402

OSM = RAIZ / "03_datos/externos/osm/piura_infraestructura.json"
IPRESS = RAIZ / "03_datos/externos/cenepred/COEN_FEN_2027_9_ipress_afectadas_operativas_COESALUD.geojson"
SALIDAS = ANALISIS / "salidas"
REGLAS = yaml.safe_load((ANALISIS / "reglas.yaml").read_text(encoding="utf-8"))

BASE_PIURA = (-5.1945, -80.6328)
RADIO_KM = 8.0  # punto asignado a la localidad EPS más cercana si está a <= 8 km del centro
CAP = REGLAS["cisterna"]["capacidadM3"]
VIAJES = REGLAS["cisterna"]["viajesPorDia"]

PESO = {"hospital": 1.0, "clinica": 1.0, "ipress_coesalud": 0.9, "consultorio": 0.6, "colegio": 0.4}
# Demanda diaria de agua por punto en emergencia (m³/día) — SUPUESTO
DEMANDA = {"hospital": 20, "clinica": 4, "consultorio": 1, "colegio": 2}
DEMANDA_IPRESS_CAT = {"I-1": 1, "I-2": 1, "I-3": 3, "I-4": 6, "II-1": 15, "II-2": 20, "II-E": 15, "III-1": 20}
RIESGO = {"Muy alto": 1.0, "Alto": 0.75, "Medio": 0.5, "Bajo": 0.25, "Muy bajo": 0.0}


def hav(a, b):
    R = 6371.0
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def localidad_cercana(p):
    d, loc = min((hav(p, (b.lat, b.lng)), b) for b in BASE)
    return (loc, d) if d <= RADIO_KM else (None, d)


def tipo_osm(t):
    am = t.get("amenity")
    return {"hospital": "hospital", "clinic": "clinica", "doctors": "consultorio", "school": "colegio"}.get(am)


def cargar_puntos():
    pts = []
    for e in json.loads(OSM.read_text(encoding="utf-8")):
        t = e.get("tags", {})
        tipo = tipo_osm(t)
        if not tipo:
            continue
        lat, lon = (e["lat"], e["lon"]) if "lat" in e else (e["center"]["lat"], e["center"]["lon"])
        pts.append(dict(fuente="OSM", osm_id=f"{e['type']}/{e['id']}", nombre=t.get("name", f"({tipo} sin nombre)"),
                        tipo=tipo, lat=lat, lon=lon, demanda_m3d=DEMANDA[tipo], ipress_afectada=False, categoria=""))
    g = json.loads(IPRESS.read_text(encoding="utf-8"))
    for f in g["features"]:
        p = f["properties"]
        pos = (p["latitud"], p["longitud"])
        dup = next((q for q in pts if q["tipo"] in ("hospital", "clinica", "consultorio") and hav(pos, (q["lat"], q["lon"])) < 0.15), None)
        dem = DEMANDA_IPRESS_CAT.get(p.get("categoria", ""), 2)
        if dup:
            dup.update(ipress_afectada=True, categoria=p.get("categoria", ""), demanda_m3d=max(dup["demanda_m3d"], dem),
                       nombre=f"{dup['nombre']} / {p['nombre_ipr']}")
        else:
            pts.append(dict(fuente="CENEPRED-COESALUD", osm_id=p.get("codigo_ún", ""), nombre=p["nombre_ipr"],
                            tipo="ipress_coesalud", lat=pos[0], lon=pos[1], demanda_m3d=dem, ipress_afectada=True,
                            categoria=p.get("categoria", "")))
    return pts


def main():
    SALIDAS.mkdir(parents=True, exist_ok=True)
    n5 = json.loads((SALIDAS / "n5_gemelo.json").read_text(encoding="utf-8"))
    flota = n5["cisternas_requeridas_total"]
    capacidad = flota * CAP * VIAJES
    cen = cargar_cenepred()
    pts = cargar_puntos()

    atendidos = []
    for p in pts:
        loc, d = localidad_cercana((p["lat"], p["lon"]))
        if not loc:
            continue
        dist = cen[UBIGEO[loc.id]]
        p.update(localidad=loc.nombre, localidad_id=loc.id, km_centro=round(d, 2), distrito=dist["nombdist"],
                 niv_sinu=dist["niv_sinu"], pobreza_pct=dist["pobrmo"])
        atendidos.append(p)
    pmax = max(p["pobreza_pct"] for p in atendidos)
    for p in atendidos:
        p["puntaje"] = round(60 * PESO[p["tipo"]] + 15 * RIESGO[p["niv_sinu"]] + 15 * p["pobreza_pct"] / pmax
                             + (10 if p["ipress_afectada"] else 0), 2)
    atendidos.sort(key=lambda p: (-p["puntaje"], -p["demanda_m3d"]))

    restante = capacidad
    for i, p in enumerate(atendidos, 1):
        q = min(p["demanda_m3d"], restante)
        restante -= q
        p.update(prioridad=i, asignado_m3d=q, viajes_dia=math.ceil(q / CAP) if q > 0 else 0,
                 cubierto="total" if q >= p["demanda_m3d"] else ("parcial" if q > 0 else "sin cobertura"),
                 km_desde_base=round(hav(BASE_PIURA, (p["lat"], p["lon"])), 1))

    campos = ["prioridad", "puntaje", "nombre", "tipo", "categoria", "fuente", "osm_id", "ipress_afectada", "localidad",
              "distrito", "niv_sinu", "pobreza_pct", "lat", "lon", "km_desde_base", "demanda_m3d", "asignado_m3d",
              "viajes_dia", "cubierto"]
    with open(SALIDAS / "n6_despacho.csv", "w", newline="", encoding="utf-8-sig") as f:
        f.write("# SUPUESTOS: demanda por punto, flota (n5 con datos EPS supuestos). Puntos: OSM + CENEPRED COESALUD (reales).\n")
        w = csv.DictWriter(f, fieldnames=campos, extrasaction="ignore")
        w.writeheader()
        w.writerows(atendidos)

    rutas = rutear(atendidos, flota)
    rutas.update(AVISO="Distancias haversine en línea recta (sin red vial); demandas y flota SUPUESTAS; una sola base en Piura.",
                 base=BASE_PIURA)
    (SALIDAS / "n6_rutas.json").write_text(json.dumps(rutas, ensure_ascii=False, indent=1), encoding="utf-8")
    resumen(atendidos, flota, capacidad, restante, rutas)
    return atendidos, rutas


def rutear(atendidos, flota):
    """CVRP: cada 'vehículo' = un viaje de cisterna (20 m³) desde la base. Se rutean los puntos de salud con
    asignación > 0 (prioridad máxima); colegios/albergues quedan en la lista voraz. Demandas > 20 m³ se parten."""
    salud = [p for p in atendidos if p["tipo"] != "colegio" and p["asignado_m3d"] > 0]
    nodos = []  # (punto, m3)
    for p in salud:
        q = p["asignado_m3d"]
        while q > 0:
            nodos.append((p, min(CAP, q)))
            q -= CAP
    coords = [BASE_PIURA] + [(p["lat"], p["lon"]) for p, _ in nodos]
    dem = [0] + [int(math.ceil(q)) for _, q in nodos]
    n_veh = min(flota * VIAJES, math.ceil(sum(dem) / CAP) + 15)
    try:
        from ortools.constraint_solver import pywrapcp, routing_enums_pb2
    except ImportError:
        return {"metodo": "voraz (ortools no disponible)", "viajes": []}
    D = [[int(hav(a, b) * 1000) for b in coords] for a in coords]
    man = pywrapcp.RoutingIndexManager(len(coords), n_veh, 0)
    rt = pywrapcp.RoutingModel(man)
    cb = rt.RegisterTransitCallback(lambda i, j: D[man.IndexToNode(i)][man.IndexToNode(j)])
    rt.SetArcCostEvaluatorOfAllVehicles(cb)
    dcb = rt.RegisterUnaryTransitCallback(lambda i: dem[man.IndexToNode(i)])
    rt.AddDimensionWithVehicleCapacity(dcb, 0, [CAP] * n_veh, True, "Carga")
    prm = pywrapcp.DefaultRoutingSearchParameters()
    prm.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    prm.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    prm.time_limit.seconds = 30
    sol = rt.SolveWithParameters(prm)
    if not sol:
        return {"metodo": "voraz (VRP sin solución)", "viajes": []}
    viajes = []
    for v in range(n_veh):
        i = rt.Start(v)
        if rt.IsEnd(sol.Value(rt.NextVar(i))):
            continue
        paradas, km, carga = [], 0.0, 0
        while not rt.IsEnd(i):
            nx = sol.Value(rt.NextVar(i))
            km += D[man.IndexToNode(i)][man.IndexToNode(nx)] / 1000
            nd = man.IndexToNode(nx)
            if nd != 0:
                p, q = nodos[nd - 1]
                paradas.append({"prioridad": p["prioridad"], "nombre": p["nombre"], "tipo": p["tipo"],
                                "lat": p["lat"], "lon": p["lon"], "m3": q})
                carga += q
            i = nx
        viajes.append({"viaje": len(viajes) + 1, "km": round(km, 1), "m3": carga, "paradas": paradas})
    viajes.sort(key=lambda v: min(p["prioridad"] for p in v["paradas"]))
    for k, v in enumerate(viajes):
        v["viaje"] = k + 1
        v["cisterna"] = k // VIAJES + 1  # 4 viajes por cisterna/día, en orden de prioridad
    return {"metodo": "OR-Tools CVRP (PATH_CHEAPEST_ARC + GLS, 30 s)", "n_nodos": len(nodos),
            "vehiculos_disponibles": n_veh, "viajes_usados": len(viajes),
            "cisternas_usadas": math.ceil(len(viajes) / VIAJES),
            "km_total": round(sum(v["km"] for v in viajes), 1), "m3_total": round(sum(v["m3"] for v in viajes), 1),
            "viajes": viajes}


def resumen(at, flota, capacidad, restante, rutas):
    from collections import Counter
    L = ["# Nivel 6 — Prescriptivo: prioridad, despacho de cisternas y rutas\n",
         "> **AVISO:** flota derivada de n5 (volúmenes/producción EPS SUPUESTOS); demandas por punto SUPUESTAS. "
         "Puntos de atención reales: OSM (hospitales, clínicas, consultorios, colegios) + IPRESS afectadas COESALUD (CENEPRED).\n",
         "## Método\n",
         "- Puntos dentro de 8 km del centro de una de las 6 localidades EPS; distrito = distrito de la localidad (aproximación).",
         "- Puntaje = 60·peso_tipo (hospital/clínica 1.0, IPRESS 0.9, consultorio 0.6, colegio 0.4) + 15·riesgo CENEPRED (niv_sinu) "
         "+ 15·pobreza relativa + 10 si IPRESS afectada en lluvias previas.",
         f"- Voraz: capacidad = {flota} cisternas × {CAP} m³ × {VIAJES} viajes = **{capacidad:,.0f} m³/día**.",
         "- Protocolo por color: `analisis/protocolo.yaml` (PROPUESTA A VALIDAR).\n",
         "## Resultados\n",
         f"- Puntos evaluados: **{len(at)}** — " + ", ".join(f"{k}: {v}" for k, v in Counter(p['tipo'] for p in at).items()),
         f"- Demanda total: **{sum(p['demanda_m3d'] for p in at):,.0f} m³/día**; asignado: **{sum(p['asignado_m3d'] for p in at):,.0f} m³/día**; "
         f"capacidad sobrante: {restante:,.0f} m³/día. Cisternas mínimas para cubrir solo estos puntos: "
         f"**{math.ceil(sum(p['demanda_m3d'] for p in at) / (CAP * VIAJES))}** (el resto de la flota n5 atiende puntos de reparto barriales "
         "fuera de esta lista, regla fraccionPrioritaria=15 % del déficit).",
         f"- Cobertura: " + ", ".join(f"{k}: {v}" for k, v in Counter(p['cubierto'] for p in at).items()),
         f"- Por localidad: " + ", ".join(f"{k}: {v}" for k, v in Counter(p['localidad'] for p in at).items()) + "\n",
         "### Top 15 de la lista de despacho\n",
         "| # | Punto | Tipo | Localidad | Puntaje | m³/día |", "|---|---|---|---|---|---|"]
    for p in at[:15]:
        L.append(f"| {p['prioridad']} | {p['nombre'][:60]} | {p['tipo']} | {p['localidad']} | {p['puntaje']} | {p['asignado_m3d']} |")
    L.append("\n## Ruteo\n")
    if rutas.get("viajes"):
        L.append(f"- Método: {rutas['metodo']}. Nodos (puntos de salud, partidos a ≤20 m³): {rutas['n_nodos']}.")
        L.append(f"- Viajes: **{rutas['viajes_usados']}** (≈ {rutas['cisternas_usadas']} cisternas a 4 viajes/día), "
                 f"**{rutas['km_total']:,.0f} km** totales ida y vuelta en línea recta, {rutas['m3_total']:,.0f} m³.")
        L.append("- Colegios/albergues se atienden con la lista voraz (no ruteados).")
    else:
        L.append(f"- {rutas['metodo']}")
    L.append("\nLimitaciones: base única en Piura (Talara está a ~100 km: en operación real conviene base por provincia); "
             "distancias haversine sin red vial ni tiempos; no se modelan ventanas horarias ni duración de jornada; "
             "la flota de n5 corresponde al escenario condicional rojo (peor caso), no a la flota real disponible de EPS Grau.")
    (SALIDAS / "n6_resumen.md").write_text("\n".join(L), encoding="utf-8")


if __name__ == "__main__":
    at, rutas = main()
    print(len(at), "puntos; asignado", sum(p["asignado_m3d"] for p in at), "; viajes", rutas.get("viajes_usados"), "km", rutas.get("km_total"))
