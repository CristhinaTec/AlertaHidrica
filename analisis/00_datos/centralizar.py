"""Centraliza los datos crudos de 03_datos/externos en DuckDB + Parquet.

Uso:  python 04_desarrollo/analisis/00_datos/centralizar.py
Idempotente: borra y recrea 03_datos/alertahidrica.duckdb y 03_datos/procesados/*.parquet.
No descarga nada: sólo lee lo que dejó el recolector.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

import duckdb
import pandas as pd
import pandera.pandas as pa

RAIZ = Path(__file__).resolve().parents[3]
EXT = RAIZ / "03_datos" / "externos"
DB = RAIZ / "03_datos" / "alertahidrica.duckdb"
PROC = RAIZ / "03_datos" / "procesados"
sys.path.insert(0, str(RAIZ / "04_desarrollo" / "recolector"))
from config import LOCALIDADES  # noqa: E402

METAS = {}  # tabla -> dict(fuente, metodo, licencia, estado)


def norm(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s.upper().strip())


def leer_geojson(p):
    return json.loads(p.read_text(encoding="utf-8"))["features"]


def centroide(geom):
    """Centroide aproximado (media de vértices) y tipo; suficiente para mapas/cruces."""
    if not geom:
        return None, None
    pts = []

    def rec(c):
        if isinstance(c, (list, tuple)) and c and isinstance(c[0], (int, float)):
            pts.append(c[:2])
        elif isinstance(c, (list, tuple)):
            for x in c:
                rec(x)
    rec(geom.get("coordinates"))
    if not pts:
        return None, None
    return sum(p[1] for p in pts) / len(pts), sum(p[0] for p in pts) / len(pts)


# ---------------------------------------------------------------- lecturas
def construir_lecturas():
    filas = []
    # 1. Lluvia ERA5 (Open-Meteo archive)
    for f in sorted((EXT / "open_meteo").glob("lluvia_historica_*.csv")):
        lid = f.stem.replace("lluvia_historica_", "")
        d = pd.read_csv(f, parse_dates=["fecha"])
        for col, var, uni in [("lluvia_mm", "lluvia", "mm"), ("tmax_c", "tmax", "°C")]:
            if col in d:
                filas.append(pd.DataFrame({"fecha": d.fecha, "id_lugar": lid, "variable": var,
                                           "valor": d[col], "unidad": uni, "fuente": "open_meteo_era5",
                                           "tipo": "reanalisis"}))
    # 2. Caudal GloFAS histórico
    for rio in ["piura", "chira", "poechos"]:
        f = EXT / "glofas" / f"caudal_historico_{rio}.csv"
        if f.exists():
            d = pd.read_csv(f, parse_dates=["fecha"])
            filas.append(pd.DataFrame({"fecha": d.fecha, "id_lugar": f"rio_{rio}", "variable": "caudal",
                                       "valor": d.caudal_glofas_m3s, "unidad": "m3/s",
                                       "fuente": "glofas_reanalisis", "tipo": "reanalisis"}))
    # 3. NOAA Niño semanal (todas las regiones del archivo)
    f = EXT / "noaa" / "nino_semanal.csv"
    if f.exists():
        d = pd.read_csv(f)
        d["fecha"] = pd.to_datetime(d.semana, format="%d%b%Y")
        for col in [c for c in d.columns if c.startswith("nino")]:
            reg, var = col.split("_")
            filas.append(pd.DataFrame({"fecha": d.fecha, "id_lugar": reg, "variable": f"sst_{var}" if var == "anom" else "sst",
                                       "valor": d[col], "unidad": "°C", "fuente": "noaa_cpc_semanal",
                                       "tipo": "observado"}))
    # 4. ONI: temporada de 3 meses -> fecha = día 1 del mes central
    f = EXT / "noaa" / "oni.csv"
    if f.exists():
        d = pd.read_csv(f)
        central = {"DJF": 1, "JFM": 2, "FMA": 3, "MAM": 4, "AMJ": 5, "MJJ": 6, "JJA": 7,
                   "JAS": 8, "ASO": 9, "SON": 10, "OND": 11, "NDJ": 12}
        d["fecha"] = pd.to_datetime(dict(year=d.anio, month=d.temporada.map(central), day=1))
        for col, var in [("total", "oni_sst"), ("anom", "oni_anom")]:
            filas.append(pd.DataFrame({"fecha": d.fecha, "id_lugar": "nino34", "variable": var,
                                       "valor": d[col], "unidad": "°C", "fuente": "noaa_cpc_oni",
                                       "tipo": "observado"}))
    base = pd.concat(filas, ignore_index=True)
    base["miembro"] = pd.NA
    base["fecha_emision"] = pd.NaT

    # 5. Pronósticos crudos/<fecha>/ (ensembles). Se omite noaa_nino.json (duplica nino_semanal).
    pron = []
    for carpeta in sorted(p for p in (EXT / "crudos").iterdir() if p.is_dir() and re.match(r"\d{4}-\d{2}-\d{2}$", p.name)):
        emision = pd.Timestamp(carpeta.name)
        for f in sorted(carpeta.glob("*.json")):
            if f.stem.startswith("glofas_"):
                lid, pref, var, uni, fte = f"rio_{f.stem[7:]}", "river_discharge", "caudal", "m3/s", "glofas_pronostico"
            elif f.stem.startswith("lluvia_"):
                lid, pref, var, uni, fte = f.stem[7:], "precipitation_sum", "lluvia", "mm", "open_meteo_ensemble"
            else:
                continue
            daily = json.loads(f.read_text(encoding="utf-8")).get("daily", {})
            t = pd.to_datetime(daily.get("time", []))
            for k, v in daily.items():
                if not k.startswith(pref):
                    continue
                m = re.search(r"member(\d+)$", k)
                pron.append(pd.DataFrame({"fecha": t, "id_lugar": lid, "variable": var,
                                          # Los ensembles traen -0,1/-0,2 mm por artefacto numérico: no existe lluvia negativa.
                                          "valor": pd.to_numeric(pd.Series(v), errors="coerce").clip(lower=0)
                                          if var == "lluvia" else pd.to_numeric(pd.Series(v), errors="coerce"),
                                          "unidad": uni, "fuente": fte, "tipo": "pronostico",
                                          "miembro": int(m.group(1)) if m else 0,  # 0 = control
                                          "fecha_emision": emision}))
    base = base.astype({"miembro": "object"})
    if pron:
        base = pd.concat([base] + pron, ignore_index=True)
    base["miembro"] = base["miembro"].astype("Int64")
    base["valor"] = base["valor"].astype(float)
    base["fecha"] = pd.to_datetime(base["fecha"])
    return base


# ---------------------------------------------------------------- otras tablas
def construir_distritos():
    cen = EXT / "cenepred"
    inu = pd.DataFrame([dict(x["properties"], **dict(zip(["lat_c", "lon_c"], centroide(x["geometry"]))))
                        for x in leer_geojson(cen / "ER_NINO2027_BD_4_Riesgos_a_inundación_.geojson")])
    mm = pd.DataFrame([x["properties"] for x in leer_geojson(cen / "ER_NINO2027_BD_5_Riesgos_a_movimientos_en_masa.geojson")])
    comunes = ["objectid", "nombdep", "nombprov", "nombdist", "viv_2017", "pob_2017", "t_eess", "t_iiee",
               "sagr_tot", "adist_km2", "st_area(shape)", "st_length(shape)", "viv_1", "iiee_1", "eess_1",
               "vias_1", "sagr_1", "pob_mon1", "vias_tot"]
    mm = mm.drop(columns=[c for c in comunes if c in mm], errors="ignore").add_suffix("_mm").rename(columns={"ubigeo_mm": "ubigeo"})
    inu = inu.drop(columns=["st_area(shape)", "st_length(shape)"], errors="ignore")
    d = inu.merge(mm, on="ubigeo", how="outer")
    d["ubigeo"] = d["ubigeo"].astype(str).str.zfill(6)
    return d


def construir_localidades(dist):
    mapa = {norm(n): (u, p) for u, n, p in zip(dist.ubigeo, dist.nombdist, dist.nombprov)}
    filas = []
    for l in LOCALIDADES:
        u, p = mapa.get(norm(l["nombre"]), (None, None))
        filas.append(dict(id_lugar=l["id"], nombre=l["nombre"], lat=l["lat"], lon=l["lon"], rio=l.get("rio"),
                          ubigeo=u, provincia=p))
    return pd.DataFrame(filas)


def construir_osm():
    els = json.loads((EXT / "osm" / "piura_infraestructura.json").read_text(encoding="utf-8"))
    if isinstance(els, dict):
        els = els.get("elements", [])
    claves = ["man_made", "amenity", "waterway", "water", "natural", "landuse", "building", "power", "highway"]
    filas = []
    for e in els:
        tags = e.get("tags", {}) or {}
        c = e.get("center", {})
        tipo = next((f"{k}={tags[k]}" for k in claves if k in tags), None)
        filas.append(dict(id=f"{e['type']}/{e['id']}", tipo_elemento=e["type"], tipo=tipo, nombre=tags.get("name"),
                          operador=tags.get("operator"), lat=e.get("lat", c.get("lat")), lon=e.get("lon", c.get("lon")),
                          tags=json.dumps(tags, ensure_ascii=False)))
    return pd.DataFrame(filas)


def construir_coen():
    filas = []
    for f in sorted((EXT / "cenepred").glob("COEN_FEN_2027_*.geojson")):
        capa = f.stem.replace("COEN_FEN_2027_", "")
        for i, x in enumerate(leer_geojson(f)):
            g = x.get("geometry") or {}
            lat, lon = centroide(g)
            pr = x.get("properties", {}) or {}
            filas.append(dict(capa=capa, fid=i, geom_tipo=g.get("type"), lat=lat, lon=lon,
                              ubigeo=str(pr.get("ubigeo") or pr.get("UBIGEO") or "") or None,
                              propiedades=json.dumps(pr, ensure_ascii=False, default=str)))
    return pd.DataFrame(filas)


def construir_capas_geo():
    """Tabla larga con capas vectoriales ANA / SENAMHI / CENEPRED extra / límites distritales."""
    filas = []
    fuentes = [("ana", "ana_geosnirh", "*.geojson"), ("senamhi", "senamhi_geoserver", "wfs_*.geojson"),
               ("cenepred", "cenepred_sigrid_extra", "extra_*.geojson"), ("inei", "limites_ana_inei", "*.geojson")]
    for carpeta, fuente, patron in fuentes:
        for f in sorted((EXT / carpeta).glob(patron)):
            gj = json.loads(f.read_text(encoding="utf-8"))
            meta = gj.get("_meta", {})
            capa = meta.get("capa") or f.stem
            for i, x in enumerate(gj.get("features", [])):
                g = x.get("geometry") or {}
                lat, lon = centroide(g)
                filas.append(dict(fuente=fuente, archivo=f.name, servicio=meta.get("servicio"), capa=str(capa), fid=i,
                                  geom_tipo=g.get("type"), lat=lat, lon=lon,
                                  propiedades=json.dumps(x.get("properties", {}) or {}, ensure_ascii=False, default=str)))
    return pd.DataFrame(filas)


# ---------------------------------------------------------------- validación
nn = dict(nullable=False)
ESQUEMAS = {
    "lecturas": pa.DataFrameSchema({
        "fecha": pa.Column("datetime64[ns]", **nn),
        "id_lugar": pa.Column(str, **nn),
        "variable": pa.Column(str, **nn),
        "valor": pa.Column(float, nullable=True),
        "fuente": pa.Column(str, **nn),
        "tipo": pa.Column(str, pa.Check.isin(["observado", "reanalisis", "pronostico"])),
        "miembro": pa.Column("Int64", pa.Check.in_range(0, 51), nullable=True),
    }, checks=[
        pa.Check(lambda d: d.loc[d.variable == "lluvia", "valor"].dropna().between(0, 500).all(), error="lluvia fuera de 0-500 mm"),
        pa.Check(lambda d: (d.loc[d.variable == "caudal", "valor"].dropna() >= 0).all(), error="caudal negativo"),
        pa.Check(lambda d: d.loc[d.variable.str.endswith("anom"), "valor"].dropna().between(-5, 10).all(), error="anomalía fuera de -5..10"),
        pa.Check(lambda d: ~d.duplicated(["fecha", "id_lugar", "variable", "fuente", "miembro", "fecha_emision"]).any(), error="claves duplicadas"),
    ]),
    "localidades": pa.DataFrameSchema({"id_lugar": pa.Column(str, unique=True, **nn),
                                       "lat": pa.Column(float, pa.Check.in_range(-6.5, -3.3)),
                                       "lon": pa.Column(float, pa.Check.in_range(-81.5, -79))}),
    "distritos_riesgo": pa.DataFrameSchema({"ubigeo": pa.Column(str, pa.Check.str_matches(r"^\d{6}$"), unique=True, **nn),
                                            "pob_2017": pa.Column(nullable=True, checks=pa.Check.ge(0))}),
    "infraestructura_osm": pa.DataFrameSchema({"id": pa.Column(str, unique=True, **nn),
                                               "lat": pa.Column(float, pa.Check.in_range(-90, 90), nullable=True),
                                               "lon": pa.Column(float, pa.Check.in_range(-180, 180), nullable=True)}),
    "capas_geo": pa.DataFrameSchema({"fuente": pa.Column(str, **nn), "capa": pa.Column(str, **nn),
                                     "lat": pa.Column(float, pa.Check.in_range(-90, 90), nullable=True),
                                     "propiedades": pa.Column(str, **nn)}),
    "cenepred_coen": pa.DataFrameSchema({"capa": pa.Column(str, **nn), "fid": pa.Column(int, **nn),
                                         "propiedades": pa.Column(str, **nn)}),
}


def validar(nombre, df, esq=None):
    esq = ESQUEMAS.get(esq or nombre)
    if esq is None:
        return "OK"
    try:
        esq.validate(df, lazy=True)
        return "OK"
    except pa.errors.SchemaErrors as e:
        fc = e.failure_cases
        resumen = "; ".join(sorted(set(f"{r.column or ''}:{r.check}" for r in fc.itertuples())))[:500]
        print(f"  [VALIDACION] {nombre}: {len(fc)} casos -> {resumen}")
        return f"ERROR_VALIDACION: {resumen}"
    except Exception as e:  # noqa: BLE001
        print(f"  [VALIDACION] {nombre}: {e}")
        return f"ERROR_VALIDACION: {e}"


# ---------------------------------------------------------------- main
def main():
    PROC.mkdir(parents=True, exist_ok=True)
    if DB.exists():
        DB.unlink()
    for p in PROC.glob("*.parquet"):
        p.unlink()
    con = duckdb.connect(str(DB))

    tablas = {}
    construir = [
        ("lecturas", construir_lecturas, "Open-Meteo ERA5 / GloFAS (CC-BY 4.0, open-meteo.com); NOAA CPC (dominio público, cpc.ncep.noaa.gov)", "API / archivo de texto"),
        ("distritos_riesgo", construir_distritos, "CENEPRED Escenarios de riesgo FEN 2027 (sigrid.cenepred.gob.pe)", "ArcGIS REST GeoJSON"),
        ("infraestructura_osm", construir_osm, "OpenStreetMap (ODbL, overpass-api.de)", "Overpass API"),
        ("capas_geo", construir_capas_geo, "ANA GeoSNIRH (geosnirh.ana.gob.pe), SENAMHI IDESEP GeoServer (idesep.senamhi.gob.pe), CENEPRED SIGRID", "ArcGIS REST / OGC WFS GeoJSON"),
        ("cenepred_coen", construir_coen, "CENEPRED/COEN capas FEN 2027 (sigrid.cenepred.gob.pe)", "ArcGIS REST GeoJSON"),
    ]
    for nombre, fn, lic, met in construir:
        try:
            tablas[nombre] = fn()
            METAS[nombre] = dict(licencia=lic, metodo=met)
        except Exception as e:  # noqa: BLE001
            print(f"  [ERROR] construyendo {nombre}: {e}")
            METAS[nombre] = dict(licencia=lic, metodo=met, estado=f"ERROR_CARGA: {e}")
    if "distritos_riesgo" in tablas:
        tablas["localidades"] = construir_localidades(tablas["distritos_riesgo"])
        METAS["localidades"] = dict(licencia="config.py del proyecto + ubigeo CENEPRED", metodo="Manual + cruce por nombre")

    catalogo = []
    for nombre, df in tablas.items():
        if nombre == "lecturas":  # validación por fuente para que el estado sea preciso
            estados = {fte: validar(f"lecturas[{fte}]", g, esq="lecturas") for fte, g in df.groupby("fuente")}
        estado = validar(nombre, df) if nombre != "lecturas" else None
        con.register("tmp", df)
        con.execute(f'CREATE TABLE "{nombre}" AS SELECT * FROM tmp')
        con.unregister("tmp")
        if nombre == "lecturas":
            con.execute("ALTER TABLE lecturas ALTER fecha TYPE DATE; ALTER TABLE lecturas ALTER fecha_emision TYPE DATE")
            con.execute("ALTER TABLE lecturas ALTER miembro TYPE SMALLINT")
            for fte, n, fmin, fmax in con.execute(
                    "SELECT fuente, count(*), min(fecha), max(fecha) FROM lecturas GROUP BY 1 ORDER BY 1").fetchall():
                catalogo.append(dict(fuente=fte, tabla=nombre, filas=n, fecha_min=str(fmin), fecha_max=str(fmax),
                                     metodo=METAS[nombre]["metodo"], licencia_url=METAS[nombre]["licencia"], estado=estados[fte]))
        else:
            catalogo.append(dict(fuente=nombre, tabla=nombre, filas=len(df), fecha_min=None, fecha_max=None,
                                 metodo=METAS[nombre]["metodo"], licencia_url=METAS[nombre]["licencia"], estado=estado))
        con.execute(f"COPY \"{nombre}\" TO '{(PROC / f'{nombre}.parquet').as_posix()}' (FORMAT PARQUET)")
    for nombre, m in METAS.items():
        if "estado" in m:
            catalogo.append(dict(fuente=nombre, tabla=nombre, filas=0, fecha_min=None, fecha_max=None,
                                 metodo=m["metodo"], licencia_url=m["licencia"], estado=m["estado"]))

    cat = pd.DataFrame(catalogo)
    con.register("tmp", cat)
    con.execute("CREATE TABLE catalogo_fuentes AS SELECT * FROM tmp")
    con.unregister("tmp")
    con.execute(f"COPY catalogo_fuentes TO '{(PROC / 'catalogo_fuentes.parquet').as_posix()}' (FORMAT PARQUET)")

    # Copia del inventario del recolector
    inv = json.loads((EXT / "inventario.json").read_text(encoding="utf-8", errors="replace"))
    invdf = pd.DataFrame(inv.get("fuentes", []))
    invdf["fecha_inventario"] = inv.get("fecha")
    con.register("tmp", invdf)
    con.execute("CREATE TABLE inventario_recolector AS SELECT * FROM tmp")
    con.unregister("tmp")
    con.execute(f"COPY inventario_recolector TO '{(PROC / 'inventario_recolector.parquet').as_posix()}' (FORMAT PARQUET)")

    print("\nTablas:")
    for (t,) in con.execute("SELECT table_name FROM information_schema.tables ORDER BY 1").fetchall():
        print(f"  {t:24s} {con.execute(f'SELECT count(*) FROM {t}').fetchone()[0]:>9,}")
    print("\nCatálogo:")
    print(con.execute("SELECT fuente, filas, fecha_min, fecha_max, left(estado,60) estado FROM catalogo_fuentes").df().to_string())
    con.close()


if __name__ == "__main__":
    main()
