"""Nivel 1 - Descriptivo con datos REALES (ERA5, GloFAS, NOAA, CENEPRED, OSM).
Salidas: salidas/n1_*.csv, n1_calidad.html, n1_resumen.md. Uso: python descriptivo.py (desde cualquier dir)."""
from pathlib import Path
import duckdb, pandas as pd, numpy as np
import pandera.pandas as pa

RAIZ = Path(__file__).resolve().parents[3]
SAL = RAIZ / "04_desarrollo/analisis/salidas"; SAL.mkdir(exist_ok=True)
con = duckdb.connect(str(RAIZ / "03_datos/alertahidrica.duckdb"), read_only=True)
q = lambda s: con.sql(s).df()

loc = q("select * from localidades")
# --- lluvia ERA5 por localidad
ll = q("select fecha,id_lugar,valor from lecturas where fuente='open_meteo_era5' and variable='lluvia'")
ll["fecha"] = pd.to_datetime(ll.fecha); ll["anio"] = ll.fecha.dt.year
anual = ll.groupby(["id_lugar", "anio"]).valor.sum().reset_index()
d_ll = ll.groupby("id_lugar").valor.agg(n="count", nulos=lambda s: s.isna().sum(), media_diaria="mean",
        p95="quantile", max="max").reset_index()
d_ll["p95"] = ll.groupby("id_lugar").valor.quantile(.95).values
d_ll["dias_ge20mm"] = ll.groupby("id_lugar").valor.apply(lambda s: (s >= 20).sum()).values
a = anual.pivot(index="id_lugar", columns="anio", values="valor")
d_ll["anual_mediana_mm"] = a.median(axis=1).values; d_ll["anual_2017_mm"] = a[2017].values; d_ll["anual_2023_mm"] = a[2023].values
d_ll = d_ll.merge(loc[["id_lugar", "nombre"]]); d_ll["origen"] = "real_era5"
d_ll.round(2).to_csv(SAL / "n1_lluvia.csv", index=False)
anual.assign(origen="real_era5").to_csv(SAL / "n1_lluvia_anual.csv", index=False)
# --- caudal GloFAS 1997+
cq = q("select fecha,id_lugar,valor from lecturas where fuente='glofas_reanalisis' and fecha>='1997-01-01'")
cq["anio"] = pd.to_datetime(cq.fecha).dt.year
d_cq = cq.groupby("id_lugar").valor.describe(percentiles=[.5, .9, .99]).reset_index()
picos = cq.groupby(["id_lugar", "anio"]).valor.max().reset_index().sort_values("valor", ascending=False)
top = picos.groupby("id_lugar").head(5); d_cq["origen"] = "real_glofas (crudo, sin factor 1.35)"
d_cq.round(1).to_csv(SAL / "n1_caudal.csv", index=False); top.to_csv(SAL / "n1_caudal_picos.csv", index=False)
# --- Nino 1+2
ni = q("select fecha,valor from lecturas where id_lugar='nino12' and variable='sst_anom' order by fecha")
d_ni = ni.valor.describe().to_frame("nino12_anom").T.assign(semanas_gt1=(ni.valor > 1).sum(), semanas_gt2=(ni.valor > 2).sum(),
        ultima_fecha=str(ni.fecha.iloc[-1]), ultima_anom=ni.valor.iloc[-1], semanas_negativas=(ni.valor < 0).sum(), origen="real_noaa")
d_ni.to_csv(SAL / "n1_nino12.csv", index=False)
# --- CENEPRED por distrito
dr = q("select ubigeo,nombprov,nombdist,pob_2017,viv_2017,niv_sinu,nriesgo_in,nriesgo_mm_mm,pobrmo,t_eess,eess_sinu,pob_mon1 from distritos_riesgo")
pob_riesgo = dr.groupby("nriesgo_in", dropna=False).agg(distritos=("ubigeo", "count"), poblacion=("pob_2017", "sum"),
        pobreza_media=("pobrmo", "mean"), eess_expuestos=("eess_sinu", "sum")).reset_index().assign(origen="real_cenepred")
pob_riesgo.to_csv(SAL / "n1_cenepred_riesgo.csv", index=False)
dr.merge(loc[["ubigeo", "nombre"]], how="right").to_csv(SAL / "n1_cenepred_localidades.csv", index=False)
# --- OSM por localidad (radio 8 km)
osm = q("select tipo,lat,lon,operador from infraestructura_osm where lat is not null")
filas = []
for _, l in loc.iterrows():
    dkm = np.hypot((osm.lat - l.lat) * 111, (osm.lon - l.lon) * 111 * np.cos(np.radians(l.lat)))
    c = osm[dkm <= 8].tipo.value_counts()
    filas.append({"id_lugar": l.id_lugar, "nombre": l.nombre, **c.to_dict()})
d_osm = pd.DataFrame(filas).fillna(0).assign(origen="real_osm (completitud OSM desconocida)")
d_osm.to_csv(SAL / "n1_osm_localidad.csv", index=False)

# --- Calidad: Pandera + informe propio (ydata-profiling no instalado en este entorno)
checks = []
def val(nombre, df, schema):
    try: schema.validate(df, lazy=True); checks.append((nombre, "OK", ""))
    except pa.errors.SchemaErrors as e: checks.append((nombre, "FALLA", str(len(e.failure_cases)) + " casos: " + e.failure_cases.check.astype(str).unique()[:3].__repr__()))
val("lluvia ERA5", ll, pa.DataFrameSchema({"valor": pa.Column(float, pa.Check.in_range(0, 500), nullable=False)}))
val("caudal GloFAS>=1997", cq, pa.DataFrameSchema({"valor": pa.Column(float, pa.Check.ge(0), nullable=False)}))
val("nino12 anom", ni, pa.DataFrameSchema({"valor": pa.Column(float, pa.Check.in_range(-5, 10))}))
val("CENEPRED", dr, pa.DataFrameSchema({"ubigeo": pa.Column(str, unique=True), "pob_2017": pa.Column(float, pa.Check.ge(0), coerce=True)}))
# huecos de fechas
huecos = {}
for lug, g in ll.groupby("id_lugar"):
    huecos[lug] = len(pd.date_range(g.fecha.min(), g.fecha.max())) - g.fecha.nunique()
dup_celda = ll.pivot(index="fecha", columns="id_lugar", values="valor")
ident = [(a_, b) for a_ in dup_celda for b in dup_celda if a_ < b and dup_celda[a_].equals(dup_celda[b])]
cal = pd.DataFrame(checks, columns=["dataset", "pandera", "detalle"])
cal.to_csv(SAL / "n1_calidad.csv", index=False)
notas = [f"Huecos de fecha en lluvia ERA5 por localidad: {huecos}",
         f"Series ERA5 idénticas (misma celda ~25 km): {ident}",
         f"Niño 1+2: {len(ni)} semanas, {int((ni.valor<0).sum())} anomalías negativas (bug conocido del recolector: sesgo cálido)",
         "GloFAS 1984-1996 nulo: se usa desde 1997. Talara (GRAU-03) sin ubigeo CENEPRED.",
         "ydata-profiling no instalado: informe propio (pip install ydata-profiling para el perfil completo)."]
html = ["<html><meta charset='utf-8'><title>Calidad N1</title><body style='font-family:sans-serif;max-width:1000px;margin:auto'>",
        "<h1>Nivel 1 — Calidad de datos REALES</h1>", cal.to_html(index=False), "<h2>Notas</h2><ul>",
        *[f"<li>{n}</li>" for n in notas], "</ul><h2>Lluvia ERA5</h2>", d_ll.round(1).to_html(index=False),
        "<h2>Caudal GloFAS (1997-2025)</h2>", d_cq.round(1).to_html(index=False),
        "<h2>CENEPRED: población por nivel de riesgo (inundación)</h2>", pob_riesgo.round(2).to_html(index=False),
        "<h2>OSM a 8 km de cada localidad</h2>", d_osm.to_html(index=False), "</body></html>"]
(SAL / "n1_calidad.html").write_text("\n".join(html), encoding="utf8")

md = ["# Nivel 1 — Descriptivo (DATOS REALES)", "",
      "Origen: ERA5 (Open-Meteo) 2000-2025, GloFAS reanálisis 1997-2025, NOAA CPC Niño 1+2, CENEPRED ER_NINO2027, OSM. Script `01_descriptivo/descriptivo.py`.", "",
      "## Lluvia ERA5 por localidad", d_ll[["nombre", "media_diaria", "p95", "max", "dias_ge20mm", "anual_mediana_mm", "anual_2017_mm", "anual_2023_mm"]].round(1).to_markdown(index=False), "",
      "## Caudal GloFAS (m³/s, crudo)", d_cq.round(0).to_markdown(index=False), "", "Picos anuales top-5:", top.to_markdown(index=False), "",
      "## Niño 1+2", d_ni.round(2).to_markdown(index=False), "",
      "## CENEPRED: población por nivel de riesgo de inundación", pob_riesgo.round(2).to_markdown(index=False), "",
      "## Infraestructura OSM (radio 8 km)", d_osm.to_markdown(index=False), "",
      "## Calidad (Pandera)", cal.to_markdown(index=False), "", *[f"- {n}" for n in notas], "",
      "Expediente DS01-DS08: ver `01_descriptivo/cargar_expediente.py` (contratos listos; hoy en modo DEMO-SINTÉTICO)."]
(SAL / "n1_resumen.md").write_text("\n".join(md), encoding="utf8")
print("\n".join(md[:12])); print(cal)
