"""Nivel 3 - Diagnostico.
A) DEMO-SINTETICO (hasta que llegue el expediente): Pareto de causas sobre DS03, indice de vulnerabilidad
   por componente IV = .30 exposicion + .25 cruce_quebrada + .20 sin_generador + .15 antiguedad + .10 estado,
   contrastado con regresion logistica (componente con corte >=72 h si/no).
B) REAL: indice de vulnerabilidad territorial por distrito con CENEPRED (riesgo, pobreza, EESS expuestos) + OSM.
Salidas: salidas/n3_*.csv, n3_resumen.md
"""
from pathlib import Path
import sys
import duckdb
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score
from scipy.stats import spearmanr

AN = Path(__file__).resolve().parents[1]
RAIZ = AN.parents[1]
SAL = AN / "salidas"
sys.path.insert(0, str(AN / "01_descriptivo"))
from cargar_expediente import cargar, ESTADO_NUM  # noqa: E402

PESOS = {"exposicion": .30, "cruce_quebrada": .25, "sin_generador": .20, "antiguedad_n": .15, "estado_n": .10}

d, modo = cargar()
AVISO = ("REAL (expediente)" if modo == "real_expediente" else
         "DEMO-SINTETICO: muestra el flujo; NO es hallazgo sobre EPS Grau")
ds02, ds03 = d["DS02"].copy(), d["DS03"].copy()

# ---- Pareto de causas
par = ds03.groupby("causa").agg(eventos=("id_evento", "count"), horas=("duracion_h", "sum")).sort_values("horas", ascending=False)
par["pct_horas"] = 100 * par.horas / par.horas.sum()
par["pct_acum"] = par.pct_horas.cumsum()
par = par.reset_index().assign(origen=modo)
par.round(1).to_csv(SAL / "n3_pareto_causas.csv", index=False)

# ---- IV por componente + logistica
ds02["sin_generador"] = 1 - ds02.grupo_electrogeno
ds02["antiguedad_n"] = (ds02.antiguedad / 45).clip(0, 1)
ds02["estado_n"] = ds02.estado.map(ESTADO_NUM).fillna(.5)
ds02["IV"] = sum(w * ds02[c] for c, w in PESOS.items())
largo = ds03[ds03.duracion_h >= 72].groupby("id_componente").size()
ds02["cortes_ge72h"] = ds02.id_componente.map(largo).fillna(0).astype(int)
ds02["y"] = (ds02.cortes_ge72h > 0).astype(int)
X = StandardScaler().fit_transform(ds02[list(PESOS)])
lr = LogisticRegression(C=1.0, max_iter=1000).fit(X, ds02.y)
coef = pd.DataFrame({"variable": list(PESOS), "peso_IV": list(PESOS.values()), "coef_logit_std": lr.coef_[0]})
coef["peso_logit_normalizado"] = coef.coef_logit_std.clip(lower=0) / coef.coef_logit_std.clip(lower=0).sum()
coef["origen"] = modo
auc_iv = roc_auc_score(ds02.y, ds02.IV) if ds02.y.nunique() > 1 else np.nan
auc_lr = roc_auc_score(ds02.y, lr.predict_proba(X)[:, 1]) if ds02.y.nunique() > 1 else np.nan
rho_iv = spearmanr(ds02.IV, ds02.cortes_ge72h)[0]
coef.round(3).to_csv(SAL / "n3_iv_vs_logit.csv", index=False)
ds02.sort_values("IV", ascending=False).round(3).to_csv(SAL / "n3_iv_componentes.csv", index=False)

# ---- REAL: vulnerabilidad territorial por distrito (CENEPRED + OSM)
con = duckdb.connect(str(RAIZ / "03_datos" / "alertahidrica.duckdb"), read_only=True)
dr = con.sql("""select ubigeo, nombprov, nombdist, pob_2017, niv_sinu, nriesgo_in, vriesgo_in, pobrmo,
    t_eess, eess_sinu, viv_sinu, viv_2017, lat_c, lon_c from distritos_riesgo""").df()
osm = con.sql("""select lat, lon, tipo from infraestructura_osm where lat is not null and tipo in
    ('man_made=water_tower','man_made=storage_tank','man_made=reservoir_covered','man_made=water_works')""").df()
con.close()
n_agua = []
for r in dr.itertuples():
    dk = np.hypot((osm.lat - r.lat_c) * 111, (osm.lon - r.lon_c) * 111 * np.cos(np.radians(r.lat_c)))
    n_agua.append(int((dk <= 5).sum()))
dr["infra_agua_osm_5km"] = n_agua
NIV = {"Muy alto": 1, "Alto": .75, "Medio": .5, "Bajo": .25, "Muy bajo": 0}
mm = lambda s: (s - s.min()) / (s.max() - s.min()) if s.max() > s.min() else s * 0
dr["c_riesgo"] = dr.nriesgo_in.map(NIV).fillna(dr.niv_sinu.map(NIV)).fillna(.5)
dr["c_pobreza"] = mm(dr.pobrmo.astype(float))
dr["c_eess"] = mm((dr.eess_sinu / dr.t_eess.replace(0, np.nan)).fillna(0))
dr["c_viv"] = mm((dr.viv_sinu / dr.viv_2017.replace(0, np.nan)).fillna(0))
dr["c_infra"] = mm(dr.infra_agua_osm_5km.astype(float))
dr["IVT"] = .35 * dr.c_riesgo + .25 * dr.c_pobreza + .15 * dr.c_eess + .15 * dr.c_viv + .10 * dr.c_infra
dr["origen"] = "real_cenepred_osm (pesos IVT supuestos)"
dr = dr.sort_values("IVT", ascending=False)
dr.round(3).to_csv(SAL / "n3_vulnerabilidad_distrital.csv", index=False)

md = ["# Nivel 3 - Diagnostico", "",
      "## A. Cortes y componentes (%s)" % AVISO, "",
      "Pareto de causas (horas de corte):", par.round(1).to_markdown(index=False), "",
      "IV por componente vs regresion logistica (y = componente con algun corte >=72 h):",
      coef.round(3).to_markdown(index=False), "",
      "- AUC IV=%.2f; AUC logistica (in-sample)=%.2f; Spearman IV vs n cortes>=72h=%.2f; n componentes=%d" % (auc_iv, auc_lr, rho_iv, len(ds02)),
      "- En modo demo el generador usa IV^2 para elegir el componente, asi que la concordancia es esperada por construccion: "
      "solo valida que el pipeline recupera la senal. Con DS02/DS03 reales esta tabla dira si los pesos .30/.25/.20/.15/.10 se sostienen.", "",
      "## B. Vulnerabilidad territorial REAL (CENEPRED + OSM)", "",
      "IVT = .35 riesgo inundacion + .25 pobreza monetaria + .15 % EESS expuestos + .15 % viviendas expuestas + .10 infra. agua OSM a 5 km (pesos supuestos; datos reales).", "",
      dr.head(15)[["nombprov", "nombdist", "pob_2017", "nriesgo_in", "pobrmo", "eess_sinu", "infra_agua_osm_5km", "IVT"]].round(3).to_markdown(index=False)]
(SAL / "n3_resumen.md").write_text("\n".join(md), encoding="utf8")
print("\n".join(md))
