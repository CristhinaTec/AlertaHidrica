"""Cargador del expediente del Desafio 2 (DS01-DS08) con contratos Pandera.

- Si hay archivos en 03_datos/expediente_desafio2/ (nombre que contenga DS01..DS08, .xlsx/.xls/.csv),
  los lee, normaliza nombres de columna y valida -> origen='real_expediente'.
- Si NO hay (situacion actual), genera DS02 (componentes) y DS03 (cortes) DEMO-SINTETICOS
  -> origen='demo_sintetico'. NUNCA usar como hallazgo.

GENERADOR DEMO (documentado):
  * 6 localidades EPS Grau, 2016-01 .. 2025-12 (ERA5/GloFAS reales terminan en 2025).
  * DS02: 12-30 componentes por localidad; tipo en {linea, pozo, captacion, planta, reservorio};
    exposicion~Beta(2,3), cruce_quebrada~Bern(0.3) solo lineas, grupo_electrogeno~Bern(0.5) en pozos
    (0.7 en planta/captacion; lineas y reservorios = 1 porque no aplica), antiguedad U(2,45),
    estado {bueno .4, regular .4, malo .2}, conexiones log-normal.
  * DS03: cortes por localidad-mes ~ Poisson(lambda),
    log lambda = -1.0 + 0.45*z(lluvia mensual ERA5 REAL, tope 4) + 0.3*z(caudal max GloFAS REAL del rio)
    -> los picos feb-mar 2017 y 2023 se heredan de los datos reales.
    Componente afectado con prob. proporcional a IV^2 (IV con los pesos del plan) para que N3 tenga senal.
    Duracion log-normal por tipo (mediana linea 110 h, pozo 91, captacion 87 [reglas.yaml], planta 36,
    reservorio 24; sigma 0.7), x(1+0.15*min(z_lluvia,4)) en meses lluviosos y x0.4 en meses secos.
    Causa segun mes lluvioso (z>1) o no. Semilla fija 2026 -> reproducible.
"""
from pathlib import Path
import re
import duckdb
import numpy as np
import pandas as pd
import pandera.pandas as pa

RAIZ = Path(__file__).resolve().parents[3]
DIR_EXP = RAIZ / "03_datos" / "expediente_desafio2"
ORIGEN_DEMO = "demo_sintetico"
TIPOS = ["linea", "pozo", "captacion", "planta", "reservorio"]
MEDIANA_H = {"linea": 110, "pozo": 91, "captacion": 87, "planta": 36, "reservorio": 24}
ESTADO_NUM = {"bueno": 0.0, "regular": 0.5, "malo": 1.0}

CONTRATOS = {
    "DS02": pa.DataFrameSchema({
        "id_componente": pa.Column(str, unique=True),
        "tipo": pa.Column(str),
        "exposicion": pa.Column(float, pa.Check.in_range(0, 1), coerce=True),
        "cruce_quebrada": pa.Column(int, pa.Check.isin([0, 1]), coerce=True),
        "grupo_electrogeno": pa.Column(int, pa.Check.isin([0, 1]), coerce=True),
        "antiguedad": pa.Column(float, pa.Check.in_range(0, 150), coerce=True),
        "estado": pa.Column(str),
        "conexiones": pa.Column(float, pa.Check.ge(0), coerce=True)}, strict=False),
    "DS03": pa.DataFrameSchema({
        "id_evento": pa.Column(str, unique=True),
        "id_componente": pa.Column(str),
        "cod_localidad": pa.Column(str),
        "fecha_inicio": pa.Column("datetime64[ns]", coerce=True),
        "fecha_fin": pa.Column("datetime64[ns]", coerce=True, nullable=True),
        "duracion_h": pa.Column(float, pa.Check.in_range(0, 24 * 120), coerce=True),
        "causa": pa.Column(str)}, strict=False),
    "DS08": pa.DataFrameSchema({
        "factor_expansion": pa.Column(float, pa.Check.gt(0), coerce=True)}, strict=False),
}
for _k in ["DS01", "DS04", "DS05", "DS06", "DS07"]:
    CONTRATOS[_k] = pa.DataFrameSchema({}, strict=False)  # columnas desconocidas hasta ver el archivo


def _norm(c):
    return re.sub(r"[^a-z0-9]+", "_", str(c).strip().lower()).strip("_")


def leer_expediente():
    """{DSxx: DataFrame validado} con lo que exista en el expediente."""
    out = {}
    if not DIR_EXP.exists():
        return out
    for f in sorted(DIR_EXP.iterdir()):
        m = re.search(r"DS0([1-8])", f.name, re.I)
        if not m or f.suffix.lower() not in (".xlsx", ".xls", ".csv"):
            continue
        k = "DS0" + m.group(1)
        df = pd.read_csv(f) if f.suffix.lower() == ".csv" else pd.read_excel(f)
        df.columns = [_norm(c) for c in df.columns]
        if "factor" in df.columns and "factor_expansion" not in df.columns:
            df = df.rename(columns={"factor": "factor_expansion"})
        out[k] = CONTRATOS[k].validate(df, lazy=True).assign(origen="real_expediente")
    return out


def amenaza_mensual(desde="1999-01-01"):
    """Panel localidad-mes con variables REALES: lluvia ERA5, caudal GloFAS, Nino 1+2 (y desfases)."""
    con = duckdb.connect(str(RAIZ / "03_datos" / "alertahidrica.duckdb"), read_only=True)
    loc = con.sql("select id_lugar, nombre, rio, ubigeo from localidades").df()
    ll = con.sql(f"""select id_lugar, date_trunc('month', fecha) mes, sum(valor) lluvia_mes,
        max(valor) lluvia_max_dia from lecturas where fuente='open_meteo_era5' and variable='lluvia'
        and fecha >= '{desde}' group by all""").df()
    cq = con.sql(f"""select replace(id_lugar, 'rio_', '') rio, date_trunc('month', fecha) mes,
        max(valor) caudal_max from lecturas where fuente='glofas_reanalisis' and fecha >= '{desde}'
        group by all""").df()
    ni = con.sql("""select date_trunc('month', fecha) mes, avg(valor) nino12 from lecturas
        where id_lugar='nino12' and variable='sst_anom' group by all""").df()
    con.close()
    df = ll.merge(loc, on="id_lugar").merge(cq, on=["rio", "mes"], how="left")
    ni["mes"] = pd.to_datetime(ni.mes)
    df["mes"] = pd.to_datetime(df.mes)
    ni = ni.set_index("mes").asfreq("MS").interpolate(limit=3)
    for lag in [0, 1, 2]:
        df["nino12_lag%d" % lag] = df.mes.map(ni.nino12.shift(lag))
    return df.sort_values(["id_lugar", "mes"]).reset_index(drop=True), loc


def generar_demo(seed=2026):
    rng = np.random.default_rng(seed)
    amen, _ = amenaza_mensual("2015-01-01")
    n_por_loc = {"GRAU-01": 30, "GRAU-02": 20, "GRAU-05": 20, "GRAU-06": 24, "GRAU-27": 14, "GRAU-03": 12}
    comps = []
    for lug, n in n_por_loc.items():
        for i, t in enumerate(rng.choice(TIPOS, n, p=[.45, .25, .1, .1, .1])):
            if t == "pozo":
                ge = int(rng.random() < .5)
            elif t in ("planta", "captacion"):
                ge = int(rng.random() < .7)
            else:
                ge = 1
            comps.append(dict(
                id_componente="%s-C%02d" % (lug, i + 1), cod_localidad=lug, tipo=str(t),
                exposicion=round(float(rng.beta(2, 3)), 2),
                cruce_quebrada=int(t == "linea" and rng.random() < .3), grupo_electrogeno=ge,
                antiguedad=float(round(rng.uniform(2, 45))),
                estado=str(rng.choice(list(ESTADO_NUM), p=[.4, .4, .2])),
                conexiones=float(round(rng.lognormal(7.5, .8)))))
    ds02 = pd.DataFrame(comps)
    iv = (.30 * ds02.exposicion + .25 * ds02.cruce_quebrada + .20 * (1 - ds02.grupo_electrogeno)
          + .15 * ds02.antiguedad / 45 + .10 * ds02.estado.map(ESTADO_NUM))
    a = amen[(amen.mes >= "2016-01-01") & (amen.mes < "2026-01-01")].copy()
    a["zl"] = a.groupby("id_lugar").lluvia_mes.transform(lambda s: (s - s.mean()) / s.std())
    a["zq"] = a.groupby("id_lugar").caudal_max.transform(lambda s: (s - s.mean()) / s.std())
    a["lam"] = np.exp(-1.0 + .45 * a.zl.clip(-1, 4) + .3 * a.zq.fillna(0).clip(-1, 4))
    ev, k = [], 0
    for r in a.itertuples():
        mask = (ds02.cod_localidad == r.id_lugar).values
        idx = np.flatnonzero(mask)
        w = iv.values[idx] ** 2
        w = w / w.sum()
        lluvioso = r.zl > 1
        for _ in range(rng.poisson(r.lam)):
            k += 1
            comp = ds02.iloc[rng.choice(idx, p=w)]
            dur = rng.lognormal(np.log(MEDIANA_H[comp.tipo]), .7) * (1 + .15 * min(max(r.zl, 0), 4)) * (1 if lluvioso else .4)
            causas = (["rotura por huaico/erosion", "turbiedad alta", "inundacion de equipo", "corte electrico"]
                      if lluvioso else ["mantenimiento", "rotura por antiguedad", "corte electrico", "turbiedad alta"])
            ini = r.mes + pd.Timedelta(days=int(rng.integers(0, 28)), hours=int(rng.integers(0, 24)))
            dur = float(min(dur, 2800))
            ev.append(dict(id_evento="EV%05d" % k, id_componente=comp.id_componente, cod_localidad=r.id_lugar,
                           fecha_inicio=ini, fecha_fin=ini + pd.Timedelta(hours=dur), duracion_h=round(dur, 1),
                           causa=str(rng.choice(causas, p=[.4, .3, .2, .1]))))
    ds02 = CONTRATOS["DS02"].validate(ds02).assign(origen=ORIGEN_DEMO)
    ds03 = CONTRATOS["DS03"].validate(pd.DataFrame(ev)).assign(origen=ORIGEN_DEMO)
    return {"DS02": ds02, "DS03": ds03}


def cargar():
    """Punto de entrada para N3/N4: (dict, modo). Real si existen DS02 y DS03; si no, demo."""
    real = leer_expediente()
    if "DS02" in real and "DS03" in real:
        return real, "real_expediente"
    demo = generar_demo()
    demo.update(real)
    return demo, ORIGEN_DEMO


if __name__ == "__main__":
    d, modo = cargar()
    print("modo:", modo)
    sal = RAIZ / "04_desarrollo" / "analisis" / "salidas"
    for k, v in d.items():
        print(k, v.shape)
        v.to_csv(sal / ("n1_%s_%s.csv" % (k.lower(), modo)), index=False)
    e = d["DS03"].copy()
    e["ym"] = e.fecha_inicio.dt.to_period("M")
    print("meses con mas cortes:\n", e.groupby("ym").size().sort_values().tail(6))
    print(e.merge(d["DS02"][["id_componente", "tipo"]]).groupby("tipo").duracion_h.median())
