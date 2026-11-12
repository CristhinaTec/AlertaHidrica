"""Nivel 7 - Mejora continua (datos REALES).
1) Registro append-only de pronosticos por fecha de emision (crudos/<fecha>/ cargados en lecturas tipo='pronostico').
2) Verificacion retrospectiva: con GloFAS reanalisis (rio Piura x1.35, Chira x1.0, umbrales de pronostico.json),
   la regla de umbrales habria marcado naranja/rojo cuantos dias antes del pico de 1998, 2017 y 2023?
   OJO: se usa el reanalisis como si fuera un pronostico perfecto -> la anticipacion es una COTA SUPERIOR
   del valor de la regla, no la anticipacion del pronostico real (para eso se necesita el archivo historico
   de pronosticos GloFAS, que se ira llenando con el registro de (1)).
3) Deriva: lluvia ERA5 2024-2025 vs 2000-2023 (KS, medias, p95), temporada ene-may.
"""
from pathlib import Path
import json
import duckdb
import numpy as np
import pandas as pd
from scipy.stats import ks_2samp

AN = Path(__file__).resolve().parents[1]
RAIZ = AN.parents[1]
SAL = AN / "salidas"
con = duckdb.connect(str(RAIZ / "03_datos" / "alertahidrica.duckdb"), read_only=True)
pron = json.loads((RAIZ / "04_desarrollo" / "web" / "public" / "data" / "pronostico.json").read_text(encoding="utf8"))

# ---- 1) Registro append-only
carpetas = sorted(p.name for p in (RAIZ / "03_datos" / "externos" / "crudos").iterdir() if p.is_dir() and p.name[:2] == "20")
reg = con.sql("""select fecha_emision, id_lugar, variable, fuente, count(distinct miembro) miembros, min(fecha) desde, max(fecha) hasta,
    round(max(valor),1) max_valor, round(avg(valor),2) media_valor
    from lecturas where tipo='pronostico' group by all order by all""").df()
reg["registrado_en"] = pd.Timestamp.now(tz="UTC").isoformat(timespec="seconds")
reg["origen"] = "real_pronostico"
f_reg = SAL / "n7_registro_pronosticos.csv"
if f_reg.exists():
    prev = pd.read_csv(f_reg)
    clave = prev.fecha_emision.astype(str) + prev.id_lugar + prev.variable + prev.fuente
    nuevo = reg[~(reg.fecha_emision.astype(str) + reg.id_lugar + reg.variable + reg.fuente).isin(clave)]
    pd.concat([prev, nuevo]).to_csv(f_reg, index=False)
else:
    nuevo = reg
    reg.to_csv(f_reg, index=False)

# ---- 2) Verificacion retrospectiva
q = con.sql("select fecha, id_lugar, valor from lecturas where fuente='glofas_reanalisis' and fecha>='1997-01-01'").df()
q["fecha"] = pd.to_datetime(q.fecha)
filas = []
for rio in ["piura", "chira"]:
    cfg = pron["rios"][rio]
    s = q[q.id_lugar == "rio_" + rio].set_index("fecha").valor * cfg.get("factor_calibracion", 1.0)
    for anio in [1998, 2017, 2023]:
        w = s[(s.index >= "%d-01-01" % anio) & (s.index <= "%d-06-30" % anio)]
        tpico, qpico = w.idxmax(), w.max()
        fila = dict(rio=rio, anio=anio, fecha_pico=tpico.date(), caudal_pico=round(qpico), umbral_tipo=cfg["tipo_umbral"])
        for nivel in ["amarillo", "naranja", "rojo"]:
            u = cfg["umbrales"][nivel]
            cruce = w[(w >= u) & (w.index <= tpico)]
            fila["primer_" + nivel] = cruce.index.min().date() if len(cruce) else None
            fila["anticipacion_dias_" + nivel] = (tpico - cruce.index.min()).days if len(cruce) else None
            fila["dias_sobre_" + nivel] = int((w >= u).sum())
        filas.append(fila)
ver = pd.DataFrame(filas).assign(origen="real_glofas_reanalisis (cota superior: pronostico perfecto)")
ver.to_csv(SAL / "n7_verificacion_retro.csv", index=False)
# falsas alarmas: anios sin evento costero con naranja
fa = []
for rio in ["piura", "chira"]:
    cfg = pron["rios"][rio]
    s = q[q.id_lugar == "rio_" + rio].set_index("fecha").valor * cfg.get("factor_calibracion", 1.0)
    an = s.groupby(s.index.year).max()
    fa.append(dict(rio=rio, anios_con_naranja=int((an >= cfg["umbrales"]["naranja"]).sum()),
                   anios_con_rojo=int((an >= cfg["umbrales"]["rojo"]).sum()),
                   anios_naranja_no_nino=", ".join(str(a) for a in an[an >= cfg["umbrales"]["naranja"]].index if a not in (1998, 2017, 2023)),
                   anios_evaluados=len(an)))
fa = pd.DataFrame(fa).assign(origen="real_glofas_reanalisis")
fa.to_csv(SAL / "n7_alarmas_anuales.csv", index=False)

# ---- 3) Deriva lluvia
ll = con.sql("select fecha, id_lugar, valor from lecturas where fuente='open_meteo_era5' and variable='lluvia'").df()
ll["fecha"] = pd.to_datetime(ll.fecha)
ll = ll[ll.fecha.dt.month <= 5]
der = []
for lug, g in ll.groupby("id_lugar"):
    ref, rec = g[g.fecha.dt.year <= 2023].valor, g[g.fecha.dt.year >= 2024].valor
    ks = ks_2samp(ref, rec)
    der.append(dict(id_lugar=lug, media_ref=ref.mean(), media_2024_25=rec.mean(), p95_ref=ref.quantile(.95),
                    p95_2024_25=rec.quantile(.95), frac_dias_lluvia_ref=(ref >= 1).mean(), frac_dias_lluvia_2024_25=(rec >= 1).mean(),
                    ks_stat=ks.statistic, ks_p=ks.pvalue, deriva=("si" if ks.pvalue < .01 else "no")))
der = pd.DataFrame(der).assign(origen="real_era5", temporada="ene-may")
der.round(3).to_csv(SAL / "n7_deriva.csv", index=False)
con.close()

md = ["# Nivel 7 - Mejora continua (DATOS REALES)", "",
      "## Registro de pronosticos", "Carpetas crudos/: %s. Filas en registro: %d (nuevas en esta corrida: %d). Con una sola emision aun no se puede verificar pronostico vs observado; el registro es append-only y se llena en cada corrida del recolector." % (carpetas, len(pd.read_csv(f_reg)), len(nuevo)), "",
      "## Verificacion retrospectiva de la regla de umbrales (GloFAS reanalisis)",
      "> Cota superior: supone pronostico perfecto. Anticipacion = dias entre el primer cruce del umbral (dentro de ene-jun) y el pico.", "",
      ver.drop(columns=["origen", "umbral_tipo"]).to_markdown(index=False), "", fa.to_markdown(index=False), "",
      "## Deriva de lluvia (ene-may, 2024-2025 vs 2000-2023)", der.round(3).drop(columns=["origen"]).to_markdown(index=False)]
(SAL / "n7_resumen.md").write_text("\n".join(md), encoding="utf8")
print("\n".join(md))
