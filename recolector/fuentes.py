"""Conectores a fuentes públicas. Cada función devuelve datos crudos y guarda una copia con fecha."""
import json
import re
import time
from datetime import date, datetime, timezone

import requests

from config import DATOS_CRUDOS, DIAS_PRONOSTICO

HEADERS = {"User-Agent": "AlertaHidrica-Piura/0.1 (prototipo hackathon Sunass)"}


def _get(url: str, params: dict, intentos: int = 3) -> dict:
    for i in range(intentos):
        try:
            r = requests.get(url, params=params, headers=HEADERS, timeout=60)
            r.raise_for_status()
            return r.json()
        except requests.RequestException:
            if i == intentos - 1:
                raise
            time.sleep(2 * (i + 1))
    return {}


def _guardar(nombre: str, datos: dict) -> None:
    carpeta = DATOS_CRUDOS / date.today().isoformat()
    carpeta.mkdir(parents=True, exist_ok=True)
    (carpeta / f"{nombre}.json").write_text(json.dumps(datos, ensure_ascii=False), encoding="utf-8")


def glofas_ensemble(clave: str, lat: float, lon: float) -> dict:
    """Caudal pronosticado (51 miembros) a 15 días. Fuente: GloFAS vía Open-Meteo Flood API."""
    d = _get("https://flood-api.open-meteo.com/v1/flood",
             dict(latitude=lat, longitude=lon, daily="river_discharge", ensemble="true",
                  forecast_days=DIAS_PRONOSTICO))
    _guardar(f"glofas_{clave}", d)
    return d


def glofas_historico(clave: str, lat: float, lon: float, inicio="2000-01-01", fin="2025-12-31") -> list[float]:
    """Serie diaria histórica (reanálisis GloFAS) para climatología y percentiles. Se cachea."""
    cache = DATOS_CRUDOS / "climatologia" / f"glofas_{clave}_{inicio[:4]}_{fin[:4]}.json"
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    d = _get("https://flood-api.open-meteo.com/v1/flood",
             dict(latitude=lat, longitude=lon, daily="river_discharge", start_date=inicio, end_date=fin))
    serie = [x for x in d["daily"]["river_discharge"] if x is not None]
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(serie), encoding="utf-8")
    return serie


def lluvia_ensemble(clave: str, lat: float, lon: float) -> dict:
    """Lluvia diaria pronosticada (51 miembros ECMWF IFS) a 15 días vía Open-Meteo Ensemble API."""
    d = _get("https://ensemble-api.open-meteo.com/v1/ensemble",
             dict(latitude=lat, longitude=lon, daily="precipitation_sum", models="ecmwf_ifs025",
                  forecast_days=DIAS_PRONOSTICO, timezone="America/Lima"))
    _guardar(f"lluvia_{clave}", d)
    return d


def ahora_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def nino_noaa() -> dict:
    """Índices semanales de temperatura del mar (NOAA CPC). Devuelve las últimas 12 semanas de Niño 1+2 y 3.4."""
    r = requests.get("https://www.cpc.ncep.noaa.gov/data/indices/wksst9120.for", headers=HEADERS, timeout=60)
    r.raise_for_status()
    filas = []
    for linea in r.text.splitlines():
        # Los negativos vienen pegados (p.ej. '24.1-0.2'); split() los perdía y descartaba la semana.
        p = linea.split()[:1] + re.findall(r"-?\d+\.\d+", " ".join(linea.split()[1:]))
        if len(p) == 9 and p[0][:2].isdigit():
            filas.append({"semana": p[0], "nino12_sst": float(p[1]), "nino12_anom": float(p[2]),
                          "nino34_sst": float(p[5]), "nino34_anom": float(p[6])})
    _guardar("noaa_nino", {"filas": filas[-52:]})
    return {"ultimas": filas[-12:]}
