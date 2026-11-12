"""NIVEL 2 - Analisis correlacional (AlertaHidrica Piura).
Solo datos reales: Open-Meteo (lluvia), GloFAS (caudal), NOAA (Nino 1+2, ONI).
Ejecutar: python correlacional.py
"""
import re
from pathlib import Path
import numpy as np
import pandas as pd
from scipy import stats
from statsmodels.tsa.stattools import ccf
import plotly.graph_objects as go
from plotly.subplots import make_subplots

RAIZ = Path(__file__).resolve().parents[3]
EXT = RAIZ / "03_datos" / "externos"
OUT = RAIZ / "04_desarrollo" / "analisis" / "salidas"
OUT.mkdir(parents=True, exist_ok=True)

CALIB_PIURA = 1.35
UMBRALES = {"amarilla_900": 900, "naranja_1290": 1290, "roja_1900": 1900}
LOCALIDADES = {"GRAU-01": "Piura", "GRAU-02": "Castilla", "GRAU-05": "GRAU-05",
               "GRAU-06": "Sullana", "GRAU-27": "Paita", "GRAU-03": "Talara"}
ANIOS_NINO = [1998, 2017, 2023]
MESES_FMA = [2, 3, 4]


# ---------------------------------------------------------------- 1. Panel
def leer_nino_semanal():
    """Prefiere el archivo oficial CPC wksst9120.for (completo, 1981-hoy).
    ADVERTENCIA: nino_semanal.csv perdio ~70% de las semanas (las de anomalia negativa,
    que vienen pegadas como '24.1-0.2'), lo que sesga la serie hacia El Nino."""
    raw = EXT / "noaa" / "wksst9120.for"
    if raw.exists():
        filas = []
        for linea in raw.read_text().splitlines():
            t = linea.split()
            if not t or not t[0][:2].isdigit():
                continue
            v = re.findall(r"-?\d+\.\d+", " ".join(t[1:]))
            if len(v) == 8:
                filas.append([t[0]] + [float(x) for x in v])
        ns = pd.DataFrame(filas, columns=["semana", "nino12_sst", "nino12_anom", "nino3_sst", "nino3_anom",
                                          "nino34_sst", "nino34_anom", "nino4_sst", "nino4_anom"])
        print(f"[info] Nino semanal desde wksst9120.for: {len(ns)} semanas")
    else:
        ns = pd.read_csv(EXT / "noaa" / "nino_semanal.csv")
        print("[ADVERTENCIA] usando nino_semanal.csv (incompleto)")
    ns["fecha"] = pd.to_datetime(ns["semana"], format="%d%b%Y")
    return ns.set_index("fecha").sort_index()


def cargar():
    lluvia = {}
    for cod, nom in LOCALIDADES.items():
        f = EXT / "open_meteo" / f"lluvia_historica_{cod}.csv"
        if f.exists():
            d = pd.read_csv(f, parse_dates=["fecha"]).set_index("fecha")
            lluvia[f"lluvia_{nom}"] = d["lluvia_mm"]
    lluvia = pd.DataFrame(lluvia)

    def caudal(n):
        d = pd.read_csv(EXT / "glofas" / f"caudal_historico_{n}.csv", parse_dates=["fecha"])
        return d.set_index("fecha")["caudal_glofas_m3s"]
    q = pd.DataFrame({"caudal_piura": caudal("piura") * CALIB_PIURA,
                      "caudal_chira": caudal("chira")})

    ns = leer_nino_semanal()
    nino = ns[["nino12_anom", "nino34_anom"]].resample("D").mean().interpolate("time")

    oni = pd.read_csv(EXT / "noaa" / "oni.csv")
    temp = ["DJF", "JFM", "FMA", "MAM", "AMJ", "MJJ", "JJA", "JAS", "ASO", "SON", "OND", "NDJ"]
    # mes central de la temporada: DJF -> enero, JFM -> febrero, ..., NDJ -> diciembre
    oni["mes"] = oni["temporada"].map({t: i + 1 for i, t in enumerate(temp)})
    oni["fecha"] = pd.to_datetime(dict(year=oni["anio"], month=oni["mes"], day=1))
    oni = oni.set_index("fecha")["anom"].rename("oni").sort_index()

    diario = pd.concat([lluvia, q, nino], axis=1).sort_index()
    diario["oni"] = oni.reindex(diario.index, method="ffill")
    return diario, oni


def mensual(diario, oni):
    llu = [c for c in diario if c.startswith("lluvia_")]
    agg = {c: "sum" for c in llu}
    agg.update({"caudal_piura": "max", "caudal_chira": "max",
                "nino12_anom": "mean", "nino34_anom": "mean"})
    m = diario.resample("MS").agg(agg)
    cnt = diario[llu].resample("MS").count()
    m[llu] = m[llu].where(cnt > 0)
    m["oni"] = oni.reindex(m.index)
    return m


# ---------------------------------------------------------------- 2. Desfases
def spearman(x, y):
    d = pd.concat([x, y], axis=1).dropna()
    if len(d) < 10:
        return np.nan, np.nan, len(d)
    r, p = stats.spearmanr(d.iloc[:, 0], d.iloc[:, 1])
    return r, p, len(d)


def desfases(diario, m):
    filas = []
    objetivos = {"lluvia_Piura (mensual)": m.get("lluvia_Piura"),
                 "lluvia_Sullana (mensual)": m.get("lluvia_Sullana"),
                 "caudal_piura_max (mensual)": m["caudal_piura"],
                 "caudal_chira_max (mensual)": m["caudal_chira"]}
    for pred in ["nino12_anom", "nino34_anom", "oni"]:
        for nom, y in objetivos.items():
            if y is None:
                continue
            for lag in range(0, 7):
                r, p, n = spearman(m[pred].shift(lag), y)
                filas.append(dict(bloque="ENSO->mensual", predictor=pred, objetivo=nom,
                                  desfase=lag, unidad="meses", rho=r, p=p, n=n))
    # lluvia acumulada -> caudal diario (todo el anio y temporada humeda ene-may)
    humeda = diario.index.month.isin([1, 2, 3, 4, 5])
    for est, qcol in [("lluvia_Piura", "caudal_piura"), ("lluvia_Sullana", "caudal_chira")]:
        if est not in diario:
            continue
        for ac in [1, 3, 7]:
            acc = diario[est].rolling(ac, min_periods=ac).sum()
            for lag in range(0, 11):
                x = acc.shift(lag)
                for tag in ["todo", "ene-may"]:
                    xx, yy = (x, diario[qcol]) if tag == "todo" else (x[humeda], diario[qcol][humeda])
                    r, p, n = spearman(xx, yy)
                    filas.append(dict(bloque=f"lluvia->caudal ({tag})",
                                      predictor=f"{est} acum {ac}d", objetivo=qcol,
                                      desfase=lag, unidad="dias", rho=r, p=p, n=n))
    df = pd.DataFrame(filas)
    # correlacion cruzada (Pearson, statsmodels): ccf(x,y)[k] = corr(x_{t+k}, y_t)
    d = diario[["lluvia_Piura", "caudal_piura"]].dropna()
    cc = ccf(np.log1p(d["caudal_piura"]), d["lluvia_Piura"], adjusted=False, nlags=11)
    ccdf = pd.DataFrame(dict(bloque="ccf pearson log(caudal) vs lluvia diaria",
                             predictor="lluvia_Piura diaria", objetivo="log1p(caudal_piura)",
                             desfase=range(11), unidad="dias", rho=cc[:11], p=np.nan, n=len(d)))
    return pd.concat([df, ccdf], ignore_index=True)


# ---------------------------------------------------------------- 3. Nino costero vs resto
def comparacion(diario):
    fma = diario[diario.index.month.isin(MESES_FMA)].copy()
    fma["anio"] = fma.index.year
    res = []
    for var, agg in [("lluvia_Piura", "sum"), ("lluvia_Sullana", "sum"),
                     ("caudal_piura", "max"), ("caudal_chira", "max")]:
        if var not in fma:
            continue
        g = fma.groupby("anio").agg(v=(var, agg), n=(var, "count"))
        g = g[g["n"] > 60]
        g["nino"] = g.index.isin(ANIOS_NINO)
        a, b = g.loc[g.nino, "v"], g.loc[~g.nino, "v"]
        u, p = stats.mannwhitneyu(a, b, alternative="greater") if len(a) and len(b) else (np.nan, np.nan)
        res.append(dict(variable=f"{var} FMA ({agg})", n_nino=len(a), n_resto=len(b),
                        mediana_nino=a.median(), mediana_resto=b.median(),
                        anios_nino=",".join(map(str, a.index)), U=u, p_unilateral=p))
    comp = pd.DataFrame(res)
    q = diario["caudal_piura"].dropna()
    dias = pd.DataFrame({k: (q > v).groupby(q.index.year).sum() for k, v in UMBRALES.items()})
    dias["caudal_max"] = q.groupby(q.index.year).max()
    return comp, dias


# ---------------------------------------------------------------- 4. Alerta temprana
def alerta(diario, umbral_q=1290):
    """Anio hidrologico jul(N-1)-jun(N). Alerta = primer dia con nino12_anom > u.
    Evento = primer dia con caudal_piura calibrado > umbral_q."""
    d0 = diario[["nino12_anom", "caudal_piura"]].copy()
    filas, resumen = [], []
    for u in [1.0, 2.0]:
        # inicio de la racha continua sobre el umbral (puede empezar antes de julio)
        sobre = d0["nino12_anom"] > u
        racha = (sobre != sobre.shift()).cumsum()
        inicio = pd.Series(d0.index, index=d0.index).groupby(racha).transform("min").where(sobre)
        d = d0[d0.index >= "1984-07-01"].copy()
        d["ah"] = d.index.year + (d.index.month >= 7)
        tp = fp = fn = tn = 0
        for ah, g in d.groupby("ah"):
            if g["caudal_piura"].notna().sum() < 300:
                continue
            al = g.index[g["nino12_anom"] > u]
            ev = g.index[g["caudal_piura"] > umbral_q]
            f_al = inicio.loc[al[0]] if len(al) else pd.NaT
            f_ev = ev[0] if len(ev) else pd.NaT
            f_al_util = pd.NaT
            if len(ev) and len(al):
                previas = al[al <= f_ev]
                if len(previas):
                    f_al_util = inicio.loc[previas[0]]
            if len(ev) and pd.notna(f_al_util):
                tipo = "acierto"; tp += 1
            elif len(ev):
                tipo = "evento no anticipado"; fn += 1
            elif len(al):
                tipo = "falsa alarma"; fp += 1
            else:
                tipo = "sin alerta ni evento"; tn += 1
            if len(ev) or len(al):
                ant = (f_ev - f_al_util).days if pd.notna(f_al_util) else np.nan
                filas.append(dict(umbral_nino12=u, umbral_caudal=umbral_q, anio_hidrologico=f"{ah-1}-{ah}",
                                  primera_alerta=f_al.date() if pd.notna(f_al) else None,
                                  primer_dia_caudal_sobre_umbral=f_ev.date() if pd.notna(f_ev) else None,
                                  dias_sobre_umbral=int((g["caudal_piura"] > umbral_q).sum()),
                                  caudal_max=round(g["caudal_piura"].max(), 1),
                                  nino12_max=round(g["nino12_anom"].max(), 2),
                                  anticipacion_dias=ant,
                                  anticipacion_semanas=round(ant / 7, 1) if pd.notna(ant) else np.nan,
                                  anticipacion_meses=round(ant / 30.44, 1) if pd.notna(ant) else np.nan,
                                  resultado=tipo))
        pod = tp / (tp + fn) if tp + fn else np.nan
        far = fp / (tp + fp) if tp + fp else np.nan
        resumen.append(dict(umbral_nino12=u, aciertos=tp, eventos_no_anticipados=fn,
                            falsas_alarmas=fp, correctos_negativos=tn, POD=pod, FAR=far))
    return pd.DataFrame(filas), pd.DataFrame(resumen)


# ---------------------------------------------------------------- 5. Graficos
def graficos(diario, m, des, dias):
    fig = make_subplots(specs=[[{"secondary_y": True}]])
    fig.add_trace(go.Scatter(x=m.index, y=m["caudal_piura"], name="Caudal max. mensual Piura (GloFAS x1.35)"))
    fig.add_trace(go.Scatter(x=m.index, y=m["nino12_anom"], name="Anomalia Nino 1+2 (°C)",
                             line=dict(dash="dot")), secondary_y=True)
    for k, v in UMBRALES.items():
        fig.add_hline(y=v, line_dash="dash", annotation_text=k, line_color="gray")
    fig.update_layout(title="Caudal rio Piura vs anomalia Nino 1+2 (mensual)")
    fig.update_yaxes(title_text="m³/s"); fig.update_yaxes(title_text="°C", secondary_y=True)
    fig.write_html(OUT / "n2_serie_caudal_nino.html", include_plotlyjs="cdn")

    e = des[des.bloque == "ENSO->mensual"]
    fig = go.Figure()
    for (pr, ob), g in e.groupby(["predictor", "objetivo"]):
        fig.add_trace(go.Scatter(x=g.desfase, y=g.rho, mode="lines+markers", name=f"{pr} -> {ob}"))
    fig.update_layout(title="Spearman ENSO vs lluvia/caudal mensual por desfase",
                      xaxis_title="Desfase (meses, ENSO adelantado)", yaxis_title="rho")
    fig.write_html(OUT / "n2_desfases_enso.html", include_plotlyjs="cdn")

    e = des[des.bloque.str.startswith("lluvia->caudal")]
    fig = go.Figure()
    for (b, pr, ob), g in e.groupby(["bloque", "predictor", "objetivo"]):
        fig.add_trace(go.Scatter(x=g.desfase, y=g.rho, mode="lines+markers", name=f"{pr} -> {ob} [{b}]"))
    fig.update_layout(title="Tiempo de respuesta lluvia -> caudal (Spearman)",
                      xaxis_title="Desfase (dias)", yaxis_title="rho")
    fig.write_html(OUT / "n2_respuesta_lluvia_caudal.html", include_plotlyjs="cdn")

    fig = go.Figure()
    for k in UMBRALES:
        fig.add_trace(go.Bar(x=dias.index, y=dias[k], name=f"dias > {k}"))
    fig.update_layout(title="Dias por anio con caudal Piura (calibrado) sobre umbrales SENAMHI",
                      barmode="group", xaxis_title="Anio", yaxis_title="dias")
    fig.write_html(OUT / "n2_dias_umbral.html", include_plotlyjs="cdn")

    fig = make_subplots(rows=3, cols=1, subplot_titles=[f"Anio hidrologico {a-1}-{a}" for a in ANIOS_NINO],
                        specs=[[{"secondary_y": True}]] * 3)
    for i, a in enumerate(ANIOS_NINO, 1):
        g = diario.loc[f"{a-1}-07-01":f"{a}-06-30"]
        fig.add_trace(go.Scatter(x=g.index, y=g["caudal_piura"], name=f"Caudal {a}",
                                 line=dict(color="#1f77b4")), row=i, col=1)
        fig.add_trace(go.Scatter(x=g.index, y=g["nino12_anom"], name=f"Nino1+2 {a}",
                                 line=dict(color="#d62728", dash="dot")), row=i, col=1, secondary_y=True)
        fig.add_hline(y=1290, line_dash="dash", line_color="gray", row=i, col=1)
    fig.update_layout(height=1000, title="Alerta temprana: Nino 1+2 (rojo, °C) vs caudal Piura (azul, m³/s)",
                      showlegend=False)
    fig.write_html(OUT / "n2_alerta_eventos.html", include_plotlyjs="cdn")


# ---------------------------------------------------------------- 6. Resumen
def fmt(x, n=2):
    return "NA" if pd.isna(x) else f"{x:.{n}f}"


def resumen_md(des, comp, dias, ev, res_al):
    L = ["# Nivel 2 - Analisis correlacional (AlertaHidrica Piura)", "",
         "Datos reales: Open-Meteo (lluvia diaria 2000-2025), GloFAS (caudal diario 1984-2025; "
         f"rio Piura x{CALIB_PIURA}), NOAA (Nino 1+2 semanal interpolado a diario, ONI). "
         "Los datos de cortes de agua del expediente NO estaban disponibles; este nivel no mide cortes.", ""]
    L.append("## 1. ENSO -> lluvia / caudal mensual (Spearman, mejor desfase 0-6 meses)")
    e = des[des.bloque == "ENSO->mensual"].dropna(subset=["rho"])
    for (pr, ob), g in e.groupby(["predictor", "objetivo"]):
        b = g.loc[g.rho.idxmax()]; g0 = g[g.desfase == 0].iloc[0]
        L.append(f"- {pr} -> {ob}: rho(0)={fmt(g0.rho)}; max rho={fmt(b.rho)} en desfase {int(b.desfase)} meses "
                 f"(p={b.p:.2g}, n={int(b.n)})")
    L += ["", "## 2. Tiempo de respuesta lluvia -> caudal (dias)"]
    e = des[des.bloque.str.startswith("lluvia->caudal")].dropna(subset=["rho"])
    for (bq, pr, ob), g in e.groupby(["bloque", "predictor", "objetivo"]):
        b = g.loc[g.rho.idxmax()]
        L.append(f"- [{bq}] {pr} -> {ob}: max rho={fmt(b.rho)} en desfase {int(b.desfase)} d (rho d0={fmt(g.iloc[0].rho)})")
    c = des[des.bloque.str.startswith("ccf")]
    b = c.loc[c.rho.idxmax()]
    L.append(f"- CCF Pearson log(caudal Piura) vs lluvia diaria Piura: pico en desfase {int(b.desfase)} d (r={fmt(b.rho)}).")
    L += ["", "## 3. El Nino costero (1998, 2017, 2023; feb-abr) vs resto (Mann-Whitney unilateral)"]
    for _, r in comp.iterrows():
        L.append(f"- {r.variable}: mediana Nino={fmt(r.mediana_nino,1)} (anios {r.anios_nino}) vs resto={fmt(r.mediana_resto,1)} "
                 f"(n={r.n_resto}); U={fmt(r.U,1)}, p={r.p_unilateral:.3g}")
    L += ["", "Dias por anio con caudal Piura calibrado sobre umbral (solo anios con algun dia > 900):", "",
          "| Anio | >900 | >1290 | >1900 | Caudal max |", "|---|---|---|---|---|"]
    for a, r in dias[dias["amarilla_900"] > 0].iterrows():
        L.append(f"| {a} | {r.amarilla_900:.0f} | {r.naranja_1290:.0f} | {r.roja_1900:.0f} | {r.caudal_max:.0f} |")
    L += ["", "## 4. Alerta temprana: Nino 1+2 > umbral precede caudal Piura > 1290 m3/s",
          "Anio hidrologico jul-jun. Acierto = alerta (Nino1+2 > umbral en algun dia del anio hidrologico, "
          "a mas tardar el primer dia > 1290). Fecha de alerta = inicio de la racha continua sobre el umbral "
          "(puede ser anterior a julio). Falsa alarma = anio con alerta y sin caudal > 1290.", ""]
    for _, r in res_al.iterrows():
        L.append(f"- Nino1+2 > +{r.umbral_nino12:.0f} °C: aciertos={r.aciertos}, eventos no anticipados={r.eventos_no_anticipados}, "
                 f"falsas alarmas={r.falsas_alarmas}, sin alerta ni evento={r.correctos_negativos}; "
                 f"POD={fmt(r.POD)}, FAR={fmt(r.FAR)}")
    L += ["", "Anticipacion por evento:", ""]
    for _, r in ev[ev.resultado != "falsa alarma"].iterrows():
        L.append(f"- {r.anio_hidrologico} (umbral +{r.umbral_nino12:.0f}): alerta {r.primera_alerta}, caudal>1290 desde "
                 f"{r.primer_dia_caudal_sobre_umbral}, anticipacion={fmt(r.anticipacion_dias,0)} d "
                 f"({fmt(r.anticipacion_meses,1)} meses), {r.dias_sobre_umbral} dias >1290, Qmax={r.caudal_max} -> {r.resultado}")
    fa = ev[ev.resultado == "falsa alarma"]
    for u, g in fa.groupby("umbral_nino12"):
        L.append(f"- Falsas alarmas con +{u:.0f} °C: {', '.join(g.anio_hidrologico)}")
    L += ["", "## Advertencias",
          "- Correlacion no es causalidad; hay muy pocos eventos extremos, las metricas de alerta son indicativas.",
          "- GloFAS es un MODELO hidrologico (reanalisis), no observacion de estacion; suele subestimar picos.",
          f"- La calibracion x{CALIB_PIURA} se derivo de un solo evento; los conteos sobre umbrales son sensibles a ese factor.",
          "- Open-Meteo es reanalisis grillado (no pluviometro) y cubre 2000-2025: 1998 no entra en las comparaciones de lluvia.",
          "- DATOS: 03_datos/externos/noaa/nino_semanal.csv esta incompleto (628 de ~2360 semanas; se perdieron las "
          "semanas con anomalias negativas pegadas, p.ej. '24.1-0.2'), lo que lo sesga hacia El Nino. Este analisis usa "
          "el archivo oficial CPC wksst9120.for (base 1991-2020). Corregir el parser del recolector historico.",
          "- Nino 1+2 semanal interpolado a diario; las fechas de alerta tienen resolucion efectiva semanal.",
          "- Este nivel no mide cortes de agua: el vinculo caudal -> corte requiere los datos del expediente."]
    txt = "\n".join(L)
    (OUT / "n2_resumen.md").write_text(txt, encoding="utf-8")
    return txt


def main():
    diario, oni = cargar()
    m = mensual(diario, oni)
    diario.to_csv(OUT / "n2_panel_diario.csv")
    m.to_csv(OUT / "n2_panel_mensual.csv")
    des = desfases(diario, m)
    des.to_csv(OUT / "n2_desfases.csv", index=False)
    comp, dias = comparacion(diario)
    comp.to_csv(OUT / "n2_nino_vs_resto.csv", index=False)
    dias.to_csv(OUT / "n2_dias_umbral.csv")
    ev, res_al = alerta(diario)
    ev.to_csv(OUT / "n2_eventos.csv", index=False)
    res_al.to_csv(OUT / "n2_alerta_metricas.csv", index=False)
    graficos(diario, m, des, dias)
    print(resumen_md(des, comp, dias, ev, res_al).encode("ascii", "replace").decode())


if __name__ == "__main__":
    main()
