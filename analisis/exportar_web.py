"""Exporta la base DuckDB/Parquet y las salidas de análisis a JSON/GeoJSON compactos para la web.

Uso:  python 04_desarrollo/analisis/exportar_web.py
Salida: 04_desarrollo/web/public/data/*.json
"""
from __future__ import annotations

import csv
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import duckdb

RAIZ = Path(__file__).resolve().parents[2]
PROC = RAIZ / "03_datos" / "procesados"
CENE = RAIZ / "03_datos" / "externos" / "cenepred"
SAL = RAIZ / "04_desarrollo" / "analisis" / "salidas"
OUT = RAIZ / "04_desarrollo" / "web" / "public" / "data"
FACTOR_PIURA = 1.35

con = duckdb.connect()
LECT = f"'{(PROC / 'lecturas.parquet').as_posix()}'"


def q(sql: str) -> list[dict]:
    df = con.sql(sql).df()
    return json.loads(df.to_json(orient="records", date_format="iso", force_ascii=False))


def r(x, n=1):
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return None
    return round(float(x), n)


def escribir(nombre: str, obj) -> None:
    p = OUT / nombre
    p.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"  {nombre:28s} {p.stat().st_size / 1024:8.1f} KB")


def leer_csv(p: Path) -> list[dict]:
    with open(p, encoding="utf-8-sig") as f:
        lineas = [l for l in f if not l.startswith("#")]
    filas = list(csv.DictReader(lineas))
    out = []
    for fila in filas:
        d = {}
        for k, v in fila.items():
            if v == "":
                d[k] = None
                continue
            try:
                fv = float(v)
                d[k] = int(fv) if fv.is_integer() and "." not in v else round(fv, 3)
            except ValueError:
                d[k] = True if v == "True" else False if v == "False" else v
        out.append(d)
    return out


# ---------------------------------------------------------------- series
def series():
    nombres = {x["id_lugar"]: x["nombre"] for x in q(f"select id_lugar, nombre from '{(PROC / 'localidades.parquet').as_posix()}'")}
    lluvia = q(f"""
        select strftime(date_trunc('month', fecha), '%Y-%m') as mes, id_lugar, sum(valor) as mm
        from {LECT} where variable='lluvia' and tipo='reanalisis'
          and fecha between '2000-01-01' and '2025-12-31'
        group by all order by mes""")
    meses: dict[str, dict] = {}
    for x in lluvia:
        meses.setdefault(x["mes"], {"mes": x["mes"]})[x["id_lugar"]] = r(x["mm"])
    caudal = q(f"""
        select strftime(date_trunc('week', fecha), '%Y-%m-%d') as semana, id_lugar, max(valor) as q
        from {LECT} where variable='caudal' and tipo='reanalisis'
        group by all order by semana""")
    sem: dict[str, dict] = {}
    for x in caudal:
        f = FACTOR_PIURA if x["id_lugar"] == "rio_piura" else 1.0
        sem.setdefault(x["semana"], {"semana": x["semana"]})[x["id_lugar"].replace("rio_", "")] = r(x["q"] * f, 0) if x["q"] is not None else None
    nino = q(f"""select strftime(fecha, '%Y-%m-%d') as semana, valor from {LECT}
                 where variable='sst_anom' and id_lugar='nino12' order by fecha""")
    oni = q(f"""select strftime(fecha, '%Y-%m') as mes, valor from {LECT}
                where variable='oni_anom' order by fecha""")
    escribir("series.json", {
        "generado": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "notas": {
            "lluvia": "Open-Meteo ERA5, suma mensual (mm) por localidad, 2000-2025",
            "caudal": f"GloFAS reanálisis, máximo semanal (m³/s). Río Piura calibrado ×{FACTOR_PIURA}; Chira sin calibrar",
            "nino12": "NOAA CPC, anomalía semanal Niño 1+2 (°C)",
            "oni": "NOAA CPC, ONI mensual (°C)",
        },
        "localidades": nombres,
        "umbrales_piura": {"amarillo": 900, "naranja": 1290, "rojo": 1900},
        "lluvia_mensual": list(meses.values()),
        "caudal_semanal": list(sem.values()),
        "nino12_semanal": [[x["semana"], r(x["valor"], 2)] for x in nino],
        "oni_mensual": [[x["mes"], r(x["valor"], 2)] for x in oni],
    })


# ---------------------------------------------------------------- geometría
def _dp(pts, tol):
    """Douglas-Peucker iterativo."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    pila = [(0, len(pts) - 1)]
    while pila:
        a, b = pila.pop()
        (x1, y1), (x2, y2) = pts[a], pts[b]
        dx, dy = x2 - x1, y2 - y1
        L = math.hypot(dx, dy)
        dmax, idx = 0.0, -1
        for i in range(a + 1, b):
            x0, y0 = pts[i]
            d = (abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / L) if L > 1e-9 else math.hypot(x0 - x1, y0 - y1)
            if d > dmax:
                dmax, idx = d, i
        if dmax > tol and idx > 0:
            keep[idx] = True
            pila += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]


def _anillo(ring, tol):
    s = _dp([(round(x, 4), round(y, 4)) for x, y, *_ in ring], tol)
    if len(s) < 4:
        return None
    if s[0] != s[-1]:
        s.append(s[0])
    return [list(p) for p in s]


def _geom(g, tol):
    if g["type"] == "Polygon":
        rings = [x for x in (_anillo(rg, tol) for rg in g["coordinates"]) if x]
        return {"type": "Polygon", "coordinates": rings} if rings else None
    polys = []
    for poly in g["coordinates"]:
        rings = [x for x in (_anillo(rg, tol) for rg in poly) if x]
        if rings:
            polys.append(rings)
    return {"type": "MultiPolygon", "coordinates": polys} if polys else None


def riesgo():
    fuente = next(CENE.glob("ER_NINO2027_BD_4_*.geojson"))
    g = json.loads(fuente.read_text(encoding="utf-8"))
    campos = {"ubigeo": "ubigeo", "nombdist": "distrito", "nombprov": "provincia", "niv_sinu": "nivel",
              "nriesgo_in": "riesgo_inundacion", "pob_2017": "poblacion", "viv_2017": "viviendas",
              "pobrmo": "pobreza_pct", "eess_sinu": "eess_expuestos", "t_eess": "eess_total"}
    for tol in (0.001, 0.002, 0.004, 0.008):
        feats = []
        for f in g["features"]:
            geom = _geom(f["geometry"], tol)
            if not geom:
                continue
            p = f["properties"]
            feats.append({"type": "Feature", "geometry": geom,
                          "properties": {v: p.get(k) for k, v in campos.items()}})
        out = {"type": "FeatureCollection",
               "fuente": "CENEPRED Escenario de riesgo FEN 2027, capa 4 (inundación), por distrito",
               "features": feats}
        if len(json.dumps(out, separators=(",", ":"))) < 1_400_000:
            break
    escribir("riesgo_distritos.geojson", out)


def infraestructura():
    tipos = {"amenity=hospital": "hospital", "amenity=clinic": "clinica", "amenity=doctors": "consultorio",
             "man_made=storage_tank": "tanque", "man_made=water_tower": "tanque",
             "man_made=reservoir_covered": "reservorio", "man_made=water_works": "planta",
             "man_made=wastewater_plant": "planta_residual"}
    filas = q(f"select id, tipo, nombre, operador, lat, lon from '{(PROC / 'infraestructura_osm.parquet').as_posix()}'")
    out = [{"id": x["id"], "cat": tipos[x["tipo"]], "nombre": x["nombre"], "operador": x["operador"],
            "lat": r(x["lat"], 5), "lon": r(x["lon"], 5)}
           for x in filas if x["tipo"] in tipos and x["lat"] is not None]
    escribir("infraestructura.json", {"fuente": "OpenStreetMap (ODbL) vía Overpass", "elementos": out})


def puntos_criticos():
    filas = q(f"""select capa, lat, lon, propiedades from '{(PROC / 'cenepred_coen.parquet').as_posix()}'
                 where geom_tipo='Point' and (capa like '25_%' or capa like '9_%')""")
    out = []
    for x in filas:
        p = json.loads(x["propiedades"])
        if x["capa"].startswith("25"):
            out.append({"capa": "punto_critico", "lat": r(x["lat"], 5), "lon": r(x["lon"], 5),
                        "nombre": p.get("sector") or p.get("nombre"), "distrito": p.get("distrito"),
                        "rio": p.get("nombre"), "peligro": p.get("peligro"), "nivel_peligro": p.get("niv_peligr"),
                        "actividad": p.get("actividad"), "costo": p.get("costo_act"), "poblacion": p.get("poblacion")})
        else:
            out.append({"capa": "ipress_afectada", "lat": r(x["lat"], 5), "lon": r(x["lon"], 5),
                        "nombre": p.get("nombre_ipr"), "distrito": p.get("distrito"), "categoria": p.get("categoria"),
                        "estado": p.get("fecha_de_r"), "temporada": p.get("temporada")})
    escribir("puntos_criticos.json", {"fuente": "COEN / CENEPRED capas FEN 2027 (25 Puntos críticos, 9 IPRESS COESALUD)",
                                      "puntos": out})


def analisis_n2():
    escribir("analisis_n2.json", {
        "fuente": "analisis/02_correlacional (datos reales; Piura ×1.35)",
        "eventos": leer_csv(SAL / "n2_eventos.csv"),
        "metricas": leer_csv(SAL / "n2_alerta_metricas.csv"),
        "desfases": leer_csv(SAL / "n2_desfases.csv"),
        "dias_umbral": leer_csv(SAL / "n2_dias_umbral.csv"),
        "nino_vs_resto": leer_csv(SAL / "n2_nino_vs_resto.csv"),
    })


def gemelo():
    g = json.loads((SAL / "n5_gemelo.json").read_text(encoding="utf-8"))
    escribir("gemelo_n5.json", g)


def despacho():
    rutas = json.loads((SAL / "n6_rutas.json").read_text(encoding="utf-8"))
    with open(SAL / "n6_despacho.csv", encoding="utf-8-sig") as f:
        aviso = f.readline().lstrip("# ").strip()
    escribir("despacho_n6.json", {"aviso": aviso, "despacho": leer_csv(SAL / "n6_despacho.csv"), "rutas": rutas})


def catalogo():
    filas = q(f"select * from '{(PROC / 'catalogo_fuentes.parquet').as_posix()}'")
    for x in filas:
        for k in ("fecha_min", "fecha_max"):
            if x.get(k):
                x[k] = str(x[k])[:10]
    escribir("catalogo.json", {"generado": datetime.now(timezone.utc).isoformat(timespec="seconds"), "fuentes": filas})


def protocolo():
    import yaml
    d = yaml.safe_load((RAIZ / "04_desarrollo" / "analisis" / "protocolo.yaml").read_text(encoding="utf-8"))
    escribir("protocolo.json", d)


def opcionales():
    """Copia salidas de otros niveles si ya existen (las generan otros scripts)."""
    for patron in ("estado_niveles.json", "n4_p_corte.json", "n1_*.json", "n3_*.json", "n7_*.json"):
        for p in SAL.glob(patron):
            try:
                escribir(p.name, json.loads(p.read_text(encoding="utf-8")))
            except Exception as e:  # noqa: BLE001
                print(f"  (omitido {p.name}: {e})")
    v = SAL / "variables_significativas.md"
    if v.exists():
        escribir("variables_significativas.json", {"markdown": v.read_text(encoding="utf-8")})


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    print("Exportando a", OUT)
    for fn in (series, riesgo, infraestructura, puntos_criticos, analisis_n2, gemelo, despacho, catalogo, protocolo, opcionales):
        fn()
