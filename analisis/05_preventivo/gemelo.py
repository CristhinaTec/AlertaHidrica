"""Nivel 5 (Preventivo): gemelo simplificado del balance de agua por localidad a 15 días.

Entradas reales : web/public/data/pronostico.json (GloFAS + ECMWF ENS), CENEPRED ER_NINO2027_BD_4 (riesgo de inundación).
Entradas SUPUESTAS: volúmenes, producción, dotación, conexiones de EPS Grau (escenarios.py, mismos valores que la web).

Reglas documentadas (también en n5_resumen.md):
  R1. Pérdida esperada de producción del día d (p_* son probabilidades de excedencia del pronóstico):
        L_d = 1.0*p_rojo + 0.5*(p_naranja - p_rojo) + 0.1*(p_amarillo - p_naranja)
      1.0 y 0.5 = perdidaProduccion (turbiedad crítica / alta) de reglas.yaml; 0.1 para amarillo es SUPUESTO.
  R2. Balance diario: S_{d+1} = clip(S_d + 24*(P*(1-L_d) - Q), 0, V). S_0 = 90 % de V (lectura normal).
      Déficit del día = parte de 24*(Q - P_d) no cubierta por S_d; horas de déficit = déficit / (Q - P_d).
  R3. Probabilidad × impacto (matriz 4x4): ver MATRIZ abajo. Impacto condicional: si la amenaza se materializa
      el día d (rojo: producción 0 durante duracionCorteH.captacion = 87 h), horas sin agua = max(0, 87 - S_d/Q).
      Impacto = población × horas sin agua × factor CENEPRED(niv_sinu del distrito).
  R4. Monte Carlo 1000 corridas: pérdidas U(25 %,45 %), dotación × U(0.85,1.15), llenado U(50 %,95 %).
"""
from __future__ import annotations
import json
import math
import sys
from pathlib import Path

import numpy as np

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
from semaforo import R, demanda_m3h  # noqa: E402
from escenarios import BASE  # noqa: E402

RAIZ = AQUI.parents[2]  # .../SUNASS/SUNASS
PRONOSTICO = RAIZ / "04_desarrollo/web/public/data/pronostico.json"
CENEPRED = RAIZ / "03_datos/externos/cenepred/ER_NINO2027_BD_4_Riesgos_a_inundación_.geojson"
SALIDAS = AQUI.parent / "salidas"

# Localidad -> distrito (ubigeo INEI). Talara = distrito Pariñas.
UBIGEO = {"GRAU-01": "200101", "GRAU-02": "200104", "GRAU-05": "200115",
          "GRAU-06": "200601", "GRAU-27": "200501", "GRAU-03": "200701"}
FACTOR_SINU = {"Muy alto": 1.5, "Alto": 1.25, "Medio": 1.0, "Bajo": 0.85, "Muy bajo": 0.7}  # SUPUESTO

PERDIDA_AMARILLO = 0.1   # SUPUESTO
LLENADO_INICIAL = 0.90   # lectura "normal" de escenarios.ts
N_MC = 1000
SEMILLA = 2027

# --- Matriz 4x4 ---------------------------------------------------------------
# Probabilidad = p_naranja del día (amenaza alta). Cortes: 0.1, prob_decision (0.3) y 0.6.
P_CORTES = [0.10, 0.30, 0.60]
P_ETIQ = ["Baja", "Media", "Alta", "Muy alta"]
# Impacto = persona·hora sin agua ajustada (población × horas × factor CENEPRED)
I_CORTES = [1e6, 5e6, 2e7]
I_ETIQ = ["Bajo", "Moderado", "Alto", "Muy alto"]
# Color = f(clase P + clase I) con clases 1..4 → suma 2..8
MATRIZ = {2: "verde", 3: "verde", 4: "amarillo", 5: "amarillo", 6: "naranja", 7: "rojo", 8: "rojo"}


def clase(v, cortes):
    return 1 + sum(v >= c for c in cortes)


def cargar_cenepred():
    g = json.loads(CENEPRED.read_text(encoding="utf-8"))
    return {f["properties"]["ubigeo"]: f["properties"] for f in g["features"]}


def perdida_esperada(d):
    pa, pn, pr = d["p_amarillo"], d["p_naranja"], d["p_rojo"]
    return (R["perdidaProduccion"]["turbiedadCritica"] * pr
            + R["perdidaProduccion"]["turbiedadAlta"] * max(0.0, pn - pr)
            + PERDIDA_AMARILLO * max(0.0, pa - pn))


def balance(prod, Q, V, S0, perdidas):
    """Vectorizado: prod, Q, V, S0 escalares o arrays (corridas). perdidas: lista diaria L_d.
    Devuelve listas por día de (S inicial, autonomía h, déficit m3, horas de déficit)."""
    S = np.asarray(S0, dtype=float)
    out = []
    for L in perdidas:
        P = prod * (1 - L)
        falt = Q - P
        with np.errstate(divide="ignore", invalid="ignore"):
            aut = np.where(falt > 0, S / np.where(falt > 0, falt, 1), np.inf)
        neto = S + 24 * (P - Q)
        deficit = np.maximum(0, -neto)
        horas = np.where(falt > 0, np.minimum(24, deficit / np.where(falt > 0, falt, 1)), 0)
        out.append((S.copy(), aut, deficit, horas))
        S = np.clip(neto, 0, V)
    return out


def main():
    SALIDAS.mkdir(parents=True, exist_ok=True)
    pron = json.loads(PRONOSTICO.read_text(encoding="utf-8"))
    cen = cargar_cenepred()
    rng = np.random.default_rng(SEMILLA)
    T_CORTE = R["duracionCorteH"]["captacion"]
    C = R["cisterna"]

    res = {"generado_por": "analisis/05_preventivo/gemelo.py",
           "pronostico_generado": pron["generado"],
           "AVISO": "Volúmenes, producción, dotación y conexiones de EPS Grau son SUPUESTOS (escenarios.ts). "
                    "Pronóstico (GloFAS/ECMWF) y riesgo CENEPRED son datos reales.",
           "reglas": {"perdida_esperada": "L=1.0*p_rojo+0.5*(p_naranja-p_rojo)+0.1*(p_amarillo-p_naranja)",
                      "llenado_inicial": LLENADO_INICIAL, "corte_condicional_h": T_CORTE,
                      "factor_cenepred": FACTOR_SINU, "p_cortes": P_CORTES, "i_cortes": I_CORTES,
                      "matriz_suma_clases": MATRIZ, "monte_carlo": {"n": N_MC, "perdidas": [0.25, 0.45],
                      "dotacion_mult": [0.85, 1.15], "llenado": [0.5, 0.95], "semilla": SEMILLA}},
           "localidades": []}

    base = {b.id: b for b in BASE}
    for lp in pron["localidades"]:
        loc = base[lp["id"]]
        dist = cen[UBIGEO[loc.id]]
        f_sinu = FACTOR_SINU[dist["niv_sinu"]]
        pob = loc.conexiones * loc.personasPorConexion
        Q = demanda_m3h(loc)
        V = loc.volumenReservoriosM3
        dias = lp["dias"]
        perd = [perdida_esperada(d) for d in dias]
        det = balance(loc.produccionM3h, Q, V, V * LLENADO_INICIAL, perd)

        # Monte Carlo
        perdidas_red = rng.uniform(0.25, 0.45, N_MC)
        dot_mult = rng.uniform(0.85, 1.15, N_MC)
        llen = rng.uniform(0.50, 0.95, N_MC)
        Qmc = pob * loc.dotacionLhd * dot_mult / 1000 / 24 * (1 + perdidas_red)
        mc = balance(loc.produccionM3h, Qmc, V, V * llen, perd)
        # Autonomía condicional (producción = 0, amenaza roja) con los llenados sorteados
        aut_rojo = V * llen / Qmc
        aut_naranja = V * llen / np.maximum(Qmc - 0.5 * loc.produccionM3h, 1e-9)
        aut_naranja = np.where(Qmc - 0.5 * loc.produccionM3h > 0, aut_naranja, np.inf)

        def pct(a):
            a = np.where(np.isfinite(a), a, 9999)
            return {k: round(float(np.percentile(a, q)), 1) for k, q in (("p10", 10), ("p50", 50), ("p90", 90))}

        filas = []
        for i, d in enumerate(dias):
            S, aut, dm3, hrs = det[i]
            S_i = float(S)
            aut_cond = S_i / Q
            horas_cond = max(0.0, T_CORTE - aut_cond)
            impacto = pob * horas_cond * f_sinu
            pc, ic = clase(d["p_naranja"], P_CORTES), clase(impacto, I_CORTES)
            Smc, autmc, dmc, hmc = mc[i]
            def_cond_m3 = horas_cond * Q
            filas.append({
                "fecha": d["fecha"], "nivel_pronostico": d["nivel"],
                "p_amarillo": d["p_amarillo"], "p_naranja": d["p_naranja"], "p_rojo": d["p_rojo"],
                "caudal_mediana": d.get("caudal_mediana"), "lluvia_mediana": d.get("lluvia_mediana"),
                "perdida_produccion_esperada": round(perd[i], 4),
                "produccion_esperada_m3h": round(loc.produccionM3h * (1 - perd[i]), 1),
                "almacenado_inicio_m3": round(S_i, 0),
                "autonomia_h": None if not math.isfinite(float(aut)) else round(float(aut), 1),
                "deficit_m3": round(float(dm3), 0), "horas_deficit": round(float(hrs), 2),
                "mc_autonomia_h": pct(autmc), "mc_deficit_m3_p90": round(float(np.percentile(dmc, 90)), 0),
                "condicional_rojo": {"autonomia_h": round(aut_cond, 1), "horas_sin_agua": round(horas_cond, 1),
                                     "deficit_m3": round(def_cond_m3, 0),
                                     "cisternas": math.ceil(def_cond_m3 * C["fraccionPrioritaria"]
                                                            / (C["capacidadM3"] * C["viajesPorDia"]))},
                "impacto_persona_hora": round(impacto, 0),
                "clase_probabilidad": P_ETIQ[pc - 1], "clase_impacto": I_ETIQ[ic - 1],
                "semaforo_pxi": MATRIZ[pc + ic],
            })
        peor = max(filas, key=lambda f: (["verde", "amarillo", "naranja", "rojo"].index(f["semaforo_pxi"]), f["p_naranja"]))
        res["localidades"].append({
            "id": loc.id, "nombre": loc.nombre, "rio": lp["rio"],
            "distrito_cenepred": {"ubigeo": UBIGEO[loc.id], "nombdist": dist["nombdist"], "niv_sinu": dist["niv_sinu"],
                                  "nriesgo_in": dist["nriesgo_in"], "pob_2017": dist["pob_2017"],
                                  "pobreza_pct": dist["pobrmo"], "eess_sinu": dist["eess_sinu"]},
            "supuestos_eps": {"poblacion_servida": pob, "demanda_m3h": round(Q, 1),
                              "produccion_m3h": loc.produccionM3h, "volumen_reservorios_m3": V},
            "mc_autonomia_rojo_h": pct(aut_rojo), "mc_autonomia_naranja_h": pct(aut_naranja),
            "dia_peor": peor["fecha"], "semaforo_peor": peor["semaforo_pxi"],
            "cisternas_condicional_max": max(f["condicional_rojo"]["cisternas"] for f in filas),
            "deficit_m3_15d_esperado": round(sum(f["deficit_m3"] for f in filas), 0),
            "dias": filas,
        })

    res["cisternas_requeridas_total"] = sum(l["cisternas_condicional_max"] for l in res["localidades"])
    (SALIDAS / "n5_gemelo.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    escribir_resumen(res)
    return res


def escribir_resumen(res):
    L = []
    L.append("# Nivel 5 — Gemelo preventivo (balance 15 días, P×I, Monte Carlo)\n")
    L.append(f"> **AVISO:** {res['AVISO']}\n")
    L.append(f"Pronóstico usado: generado {res['pronostico_generado']}. Script: `analisis/05_preventivo/gemelo.py`.\n")
    L.append("## Reglas\n")
    L.append("1. **Pérdida esperada de producción** del día: `L = 1.0·p_rojo + 0.5·(p_naranja−p_rojo) + 0.1·(p_amarillo−p_naranja)` "
             "(1.0 y 0.5 = `perdidaProduccion` de reglas.yaml; 0.1 en amarillo es supuesto).")
    L.append("2. **Balance diario**: almacenamiento inicial 90 % del volumen; `S(d+1) = clip(S + 24·(P·(1−L) − Q), 0, V)`; "
             "déficit = faltante no cubierto por el reservorio.")
    L.append("3. **Impacto condicional**: si el día d se materializa amenaza roja (producción 0 durante 87 h = duracionCorteH.captacion), "
             "horas sin agua = max(0, 87 − S_d/Q); impacto = población × horas × factor CENEPRED "
             "(niv_sinu: Muy alto 1.5, Alto 1.25, Medio 1.0, Bajo 0.85, Muy bajo 0.7 — factores supuestos).")
    L.append("4. **Monte Carlo** 1000 corridas: pérdidas de red U(25–45 %), dotación ×U(0.85–1.15), llenado U(50–95 %).\n")
    L.append("## Matriz probabilidad × impacto (4×4)\n")
    L.append("Probabilidad = `p_naranja` del día: Baja <0.10 ≤ Media <0.30 ≤ Alta <0.60 ≤ Muy alta. "
             "Impacto (persona·hora ajustada): Bajo <1 M ≤ Moderado <5 M ≤ Alto <20 M ≤ Muy alto. Color por suma de clases (1–4 c/u).\n")
    L.append("| Prob. \\ Impacto | Bajo | Moderado | Alto | Muy alto |")
    L.append("|---|---|---|---|---|")
    for p in range(4, 0, -1):
        L.append(f"| {P_ETIQ[p-1]} | " + " | ".join(MATRIZ[p + i] for i in range(1, 5)) + " |")
    L.append("\n## Resultados por localidad\n")
    L.append("| Localidad | Distrito (niv_sinu) | Máx p_naranja | Día peor | Semáforo P×I | Déficit esperado 15 d (m³) | Autonomía si rojo P10–P50–P90 (h) | Autonomía si naranja P10–P90 (h) | Cisternas cond. |")
    L.append("|---|---|---|---|---|---|---|---|---|")
    for l in res["localidades"]:
        a, n = l["mc_autonomia_rojo_h"], l["mc_autonomia_naranja_h"]
        pn = max(d["p_naranja"] for d in l["dias"])
        fn = lambda v: "∞" if v >= 9999 else f"{v:.0f}"
        L.append(f"| {l['nombre']} | {l['distrito_cenepred']['nombdist']} ({l['distrito_cenepred']['niv_sinu']}) | {pn:.2f} | {l['dia_peor']} | "
                 f"{l['semaforo_peor']} | {l['deficit_m3_15d_esperado']:.0f} | {a['p10']:.0f}–{a['p50']:.0f}–{a['p90']:.0f} | "
                 f"{fn(n['p10'])}–{fn(n['p90'])} | {l['cisternas_condicional_max']} |")
    L.append(f"\n**Cisternas requeridas (escenario condicional rojo, suma de máximos por localidad): {res['cisternas_requeridas_total']}** "
             "— regla del motor: ceil(déficit × 0.15 / (20 m³ × 4 viajes)). Esta cifra alimenta el Nivel 6.\n")
    L.append("## Semáforo P×I por día\n")
    fechas = [d["fecha"] for d in res["localidades"][0]["dias"]]
    L.append("| Localidad | " + " | ".join(f[5:] for f in fechas) + " |")
    L.append("|---|" + "---|" * len(fechas))
    for l in res["localidades"]:
        L.append(f"| {l['nombre']} | " + " | ".join(d["semaforo_pxi"][:3] for d in l["dias"]) + " |")
    L.append("\nLimitaciones: un solo reservorio agregado por localidad; producción y volúmenes supuestos; "
             "la pérdida por probabilidad es un valor esperado, no una trayectoria; Paita/Talara usan el pronóstico del río Chira "
             "como proxy de amenaza en la fuente.")
    (SALIDAS / "n5_resumen.md").write_text("\n".join(L), encoding="utf-8")


if __name__ == "__main__":
    r = main()
    for l in r["localidades"]:
        print(l["id"], l["nombre"], l["semaforo_peor"], l["dia_peor"], l["mc_autonomia_rojo_h"], l["deficit_m3_15d_esperado"], l["cisternas_condicional_max"])
    print("cisternas total", r["cisternas_requeridas_total"])
