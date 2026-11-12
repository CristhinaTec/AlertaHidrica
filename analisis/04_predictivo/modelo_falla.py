"""Nivel 4 (falla) - P(corte >= 72 h en localidad-mes) dada la amenaza REAL + vulnerabilidad.

DEMOSTRACION DEL METODO, no precision real: el objetivo (cortes) es DEMO-SINTETICO hasta que llegue DS03.
Variables X: REALES (lluvia mensual y max diaria ERA5, caudal max GloFAS, Nino 1+2 con desfase 0-2 meses)
+ IV medio de la localidad (demo mientras no haya DS02).
Validacion temporal: (a) entrena todo salvo 2017 -> prueba 2017; (b) entrena todo salvo 2023 -> prueba 2023.
Metricas: Brier, AUC, curva de calibracion, POD/FAR (umbral 0.3 = prob_decision) vs regla "alertar todo feb-mar".
Importancia por permutacion -> n4_importancia.csv. Aplica al pronostico actual -> n4_p_corte.json.
"""
from pathlib import Path
import sys, json
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import brier_score_loss, roc_auc_score
from sklearn.calibration import calibration_curve
from sklearn.inspection import permutation_importance

AN = Path(__file__).resolve().parents[1]
RAIZ = AN.parents[1]
SAL = AN / "salidas"
sys.path.insert(0, str(AN / "01_descriptivo"))
from cargar_expediente import cargar, amenaza_mensual, ESTADO_NUM  # noqa: E402

d, modo = cargar()
ROT = "DEMOSTRACION DEL METODO, no precision real (objetivo demo_sintetico)" if modo != "real_expediente" else "REAL"
amen, loc = amenaza_mensual("2015-01-01")
amen = amen[(amen.mes >= "2016-01-01") & (amen.mes < "2026-01-01")].copy()
ds02, ds03 = d["DS02"].copy(), d["DS03"].copy()
ds02["IV"] = (.30 * ds02.exposicion + .25 * ds02.cruce_quebrada + .20 * (1 - ds02.grupo_electrogeno)
              + .15 * (ds02.antiguedad / 45).clip(0, 1) + .10 * ds02.estado.map(ESTADO_NUM).fillna(.5))
iv_loc = ds02.groupby("cod_localidad").IV.mean()
ds03["mes"] = ds03.fecha_inicio.dt.to_period("M").dt.to_timestamp()
y = ds03[ds03.duracion_h >= 72].groupby(["cod_localidad", "mes"]).size().rename("n").reset_index()
amen = amen.merge(y, left_on=["id_lugar", "mes"], right_on=["cod_localidad", "mes"], how="left")
amen["y"] = (amen.n.fillna(0) > 0).astype(int)
amen["iv_loc"] = amen.id_lugar.map(iv_loc)
amen["log_caudal_max"] = np.log1p(amen.caudal_max)
amen["log_lluvia_mes"] = np.log1p(amen.lluvia_mes)
FEAT = ["log_lluvia_mes", "lluvia_max_dia", "log_caudal_max", "nino12_lag0", "nino12_lag1", "nino12_lag2", "iv_loc"]
amen = amen.dropna(subset=FEAT)
amen["anio"] = amen.mes.dt.year


def modelo():
    return make_pipeline(StandardScaler(), LogisticRegression(C=0.5, max_iter=2000))


try:
    import lightgbm as lgb
    def modelo_gbm():
        return lgb.LGBMClassifier(n_estimators=150, learning_rate=.05, num_leaves=7, min_child_samples=10, verbose=-1)
except Exception:
    modelo_gbm = None

PDEC = 0.3
filas, cal_rows, preds = [], [], []
for anio_test in [2017, 2023]:
    tr, te = amen[amen.anio != anio_test], amen[amen.anio == anio_test]
    base = te.mes.dt.month.isin([2, 3]).astype(int)
    modelos = {"logistica": modelo()}
    if modelo_gbm:
        modelos["lightgbm"] = modelo_gbm()
    for nombre, m in modelos.items():
        m.fit(tr[FEAT], tr.y)
        p = m.predict_proba(te[FEAT])[:, 1]
        preds.append(te[["id_lugar", "mes", "y"]].assign(p=p, modelo=nombre, prueba=anio_test))
        for etiqueta, alerta, score in [(nombre, (p >= PDEC).astype(int), p), ("regla_feb_mar", base, base)]:
            if etiqueta == "regla_feb_mar" and nombre != "logistica":
                continue
            tp = int(((alerta == 1) & (te.y == 1)).sum()); fn = int(((alerta == 0) & (te.y == 1)).sum())
            fp = int(((alerta == 1) & (te.y == 0)).sum())
            filas.append(dict(prueba=anio_test, metodo=etiqueta, n=len(te), eventos=int(te.y.sum()),
                              brier=brier_score_loss(te.y, np.clip(score, 0, 1)),
                              auc=roc_auc_score(te.y, score) if te.y.nunique() > 1 else np.nan,
                              POD=tp / (tp + fn) if tp + fn else np.nan, FAR=fp / (tp + fp) if tp + fp else np.nan,
                              origen_objetivo=modo))
met = pd.DataFrame(filas)
met.round(3).to_csv(SAL / "n4_validacion.csv", index=False)
pr = pd.concat(preds)
for nombre, g in pr.groupby("modelo"):
    fy, fx = calibration_curve(g.y, g.p, n_bins=5, strategy="quantile")
    cal_rows += [dict(modelo=nombre, p_media=a, frec_obs=b) for a, b in zip(fx, fy)]
pd.DataFrame(cal_rows).assign(origen_objetivo=modo).round(3).to_csv(SAL / "n4_calibracion.csv", index=False)

# Modelo final con todos los anios + importancia
final = modelo().fit(amen[FEAT], amen.y)
pi = permutation_importance(final, amen[FEAT], amen.y, scoring="neg_brier_score", n_repeats=30, random_state=0)
coefs = final[-1].coef_[0]
imp = pd.DataFrame({"variable": FEAT, "importancia_perm_brier": pi.importances_mean, "sd": pi.importances_std,
                    "coef_logit_std": coefs}).sort_values("importancia_perm_brier", ascending=False)
imp["tipo_dato_X"] = ["demo_sintetico" if v == "iv_loc" else "real" for v in imp.variable]
imp["origen_objetivo"] = modo
imp["rotulo"] = ROT
imp.round(5).to_csv(SAL / "n4_importancia.csv", index=False)

# ---- Aplicar al pronostico actual (solo lectura de web/public/data/pronostico.json)
pron = json.loads((RAIZ / "04_desarrollo" / "web" / "public" / "data" / "pronostico.json").read_text(encoding="utf8"))
nino_ult = pron["nino"]["ultimas"]
n0 = nino_ult[-1]["nino12_anom"]; n1 = nino_ult[-5]["nino12_anom"] if len(nino_ult) >= 5 else n0
n2 = nino_ult[-9]["nino12_anom"] if len(nino_ult) >= 9 else n1
salida = {"generado_desde": pron["generado"], "rotulo": ROT, "origen_objetivo": modo,
          "metodo": "Para cada dia d: lluvia acumulada (mediana ensemble) desde el inicio del pronostico escalada a 30 dias, "
                    "lluvia max diaria (p90), caudal max (p90 / factor_calibracion para volver a escala GloFAS cruda), "
                    "Nino 1+2 ultimas semanas como desfase 0/1/2 meses, IV medio de la localidad.",
          "localidades": []}
for L in pron["localidades"]:
    fac = pron["rios"][L["rio"]].get("factor_calibracion", 1.0)
    dias, acum, qmax, lmax = [], 0.0, 0.0, 0.0
    for k, dd in enumerate(L["dias"], start=1):
        acum += dd.get("lluvia_mediana") or 0
        lmax = max(lmax, dd.get("lluvia_p90") or 0)
        qmax = max(qmax, (dd.get("caudal_p90") or 0) / fac)
        x = pd.DataFrame([dict(log_lluvia_mes=np.log1p(acum * 30 / k), lluvia_max_dia=lmax, log_caudal_max=np.log1p(qmax),
                               nino12_lag0=n0, nino12_lag1=n1, nino12_lag2=n2, iv_loc=iv_loc.get(L["id"], iv_loc.mean()))])
        dias.append({"fecha": dd["fecha"], "p_corte_72h": round(float(final.predict_proba(x[FEAT])[0, 1]), 3)})
    salida["localidades"].append({"id": L["id"], "nombre": L["nombre"], "dias": dias})
(SAL / "n4_p_corte.json").write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf8")

resumen_p = pd.DataFrame([{"localidad": l["nombre"], "p_max": max(x["p_corte_72h"] for x in l["dias"])} for l in salida["localidades"]])
md = ["# Nivel 4 - Modelo de falla (corte >= 72 h en localidad-mes)", "", "> **%s**" % ROT, "",
      "Panel %d localidad-mes 2016-2025; tasa base y=1: %.2f. X reales (ERA5, GloFAS, NOAA) + IV demo." % (len(amen), amen.y.mean()), "",
      "## Validacion temporal", met.round(3).to_markdown(index=False), "",
      "## Importancia (permutacion, Brier) - modelo logistico final", imp.round(4).to_markdown(index=False), "",
      "## Aplicacion al pronostico actual (%s)" % pron["generado"], resumen_p.to_markdown(index=False), "",
      "Limitaciones: el objetivo se genero a partir de lluvia/caudal reales, por eso las metricas son optimistas por construccion; "
      "el Nino 1+2 actual (+%.1f C) esta fuera del rango de entrenamiento 2016-2025 salvo 2017/2023 (extrapolacion)." % n0]
(SAL / "n4_resumen.md").write_text("\n".join(md), encoding="utf8")
print("\n".join(md))
