"""Recolecta las fuentes y calcula el pronóstico probabilístico por localidad y día.

Uso:  python pronostico.py
Salida: web/public/data/pronostico.json (lo lee el tablero) y copia cruda en 03_datos/externos/crudos/.

Método:
  P(nivel, día) = fracción de los 51 miembros del ensemble que superan el umbral de ese nivel
  (caudal calibrado o lluvia diaria). El nivel del día es el más alto cuya probabilidad >= PROB_DECISION.
  Esta es la AMENAZA pronosticada; el tablero la combina luego con la autonomía y la vulnerabilidad.
"""
import json

import config as C
import fuentes as F

ORDEN = ["verde", "amarillo", "naranja", "rojo"]


def percentil(valores: list[float], q: float) -> float:
    v = sorted(valores)
    i = min(len(v) - 1, max(0, round(q * (len(v) - 1))))
    return v[i]


def umbrales_rio(clave: str, rio: dict) -> dict:
    if rio["umbrales"]:
        return rio["umbrales"]
    serie = F.glofas_historico(clave, rio["lat"], rio["lon"])
    return {n: round(percentil(serie, q), 1) for n, q in rio["percentiles"].items()}


def miembros(daily: dict, prefijo: str) -> list[list[float]]:
    claves = [k for k in daily if k.startswith(prefijo)]
    return [[x if x is not None else 0.0 for x in daily[k]] for k in claves]


def prob_supera(valores: list[float], umbral: float) -> float:
    return round(sum(v >= umbral for v in valores) / len(valores), 3) if valores else 0.0


def main() -> None:
    rios = {}
    for clave, rio in C.RIOS.items():
        d = F.glofas_ensemble(clave, rio["lat"], rio["lon"])["daily"]
        ms = [[x * rio["factor_calibracion"] for x in m] for m in miembros(d, "river_discharge")]
        rios[clave] = {"fechas": d["time"], "miembros": ms, "umbrales": umbrales_rio(clave, rio)}

    salida_loc = []
    for loc in C.LOCALIDADES:
        rio = rios[loc["rio"]]
        lluvia = F.lluvia_ensemble(loc["id"], loc["lat"], loc["lon"])["daily"]
        lm = miembros(lluvia, "precipitation_sum")
        fechas_ll = lluvia["time"]
        dias = []
        for i, fecha in enumerate(rio["fechas"]):
            caudales = [m[i] for m in rio["miembros"] if i < len(m)]
            j = fechas_ll.index(fecha) if fecha in fechas_ll else None
            lluvias = [m[j] for m in lm] if j is not None else []
            p = {}
            for n in ORDEN[1:]:
                p[n] = max(prob_supera(caudales, rio["umbrales"][n]), prob_supera(lluvias, C.LLUVIA_UMBRALES[n]))
            nivel = "verde"
            for n in ORDEN[1:]:
                if p[n] >= C.PROB_DECISION:
                    nivel = n
            dias.append({
                "fecha": fecha, "nivel": nivel,
                "p_amarillo": p["amarillo"], "p_naranja": p["naranja"], "p_rojo": p["rojo"],
                "caudal_mediana": round(percentil(caudales, 0.5), 1),
                "caudal_p90": round(percentil(caudales, 0.9), 1),
                "lluvia_mediana": round(percentil(lluvias, 0.5), 1) if lluvias else None,
                "lluvia_p90": round(percentil(lluvias, 0.9), 1) if lluvias else None,
            })
        criticos = [d for d in dias if d["p_naranja"] > 0]
        dia_critico = max(criticos, key=lambda d: (d["p_rojo"], d["p_naranja"]))["fecha"] if criticos else None
        salida_loc.append({**loc, "rio_nombre": C.RIOS[loc["rio"]]["nombre"], "dias": dias, "dia_critico": dia_critico,
                           "nivel_max": max((d["nivel"] for d in dias), key=ORDEN.index)})

    salida = {
        "generado": F.ahora_iso(),
        "enfen": C.ENFEN,
        "nino": F.nino_noaa(),
        "prob_decision": C.PROB_DECISION,
        "rios": {k: {"nombre": C.RIOS[k]["nombre"], "umbrales": v["umbrales"], "tipo_umbral": C.RIOS[k]["tipo_umbral"],
                     "factor_calibracion": round(C.RIOS[k]["factor_calibracion"], 3)} for k, v in rios.items()},
        "lluvia_umbrales": C.LLUVIA_UMBRALES,
        "fuentes": [
            {"nombre": "GloFAS (Copernicus) vía Open-Meteo Flood API", "variable": "Caudal, 51 miembros, 15 días", "url": "https://open-meteo.com/en/docs/flood-api"},
            {"nombre": "ECMWF IFS 0.25° ensemble vía Open-Meteo", "variable": "Lluvia diaria, 51 miembros, 15 días", "url": "https://open-meteo.com/en/docs/ensemble-api"},
            {"nombre": "NOAA CPC índices Niño (semanal)", "variable": "Anomalía de temperatura del mar Niño 1+2 y 3.4", "url": "https://www.cpc.ncep.noaa.gov/data/indices/wksst9120.for"},
            {"nombre": "Comunicado ENFEN", "variable": "Estado de alerta (manual)", "url": C.ENFEN["url"]},
        ],
        "localidades": salida_loc,
    }
    C.SALIDA_WEB.mkdir(parents=True, exist_ok=True)
    (C.SALIDA_WEB / "pronostico.json").write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")
    for l in salida_loc:
        print(f"{l['nombre']:<24} máx: {l['nivel_max']:<9} día crítico: {l['dia_critico']}")


if __name__ == "__main__":
    main()
