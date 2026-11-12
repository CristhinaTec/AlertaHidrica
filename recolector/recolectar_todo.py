"""Recolector masivo: intenta TODAS las fuentes públicas identificadas y deja un inventario de qué funcionó.

Uso: python recolectar_todo.py
Salida: 03_datos/externos/<fuente>/... + 03_datos/externos/inventario.json
Cada conector es independiente: si uno falla, los demás siguen.
"""
import csv
import json
import re
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

import requests

from config import LOCALIDADES, RIOS, RAIZ

EXT = RAIZ / "03_datos" / "externos"
UA_BOT = {"User-Agent": "AlertaHidrica-Piura/0.1 (prototipo hackathon Sunass; uso academico)"}
# Siempre nos identificamos con nuestro nombre real: no imitamos navegadores ni evadimos bloqueos anti-bots.
UA_NAV = UA_BOT
BBOX_PIURA = (-5.45, -81.35, -4.45, -80.25)  # sur, oeste, norte, este (Piura, Sullana, Paita, Talara)
inventario: list[dict] = []


def guardar(rel: str, contenido, modo="json") -> Path:
    p = EXT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    if modo == "json":
        p.write_text(json.dumps(contenido, ensure_ascii=False, indent=1), encoding="utf-8")
    elif modo == "csv":
        with p.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(contenido[0].keys()))
            w.writeheader(); w.writerows(contenido)
    else:
        p.write_text(contenido, encoding="utf-8")
    return p


def conector(nombre: str, capa: str, metodo: str):
    def deco(fn):
        def run():
            t = time.time()
            try:
                detalle = fn()
                inventario.append({"fuente": nombre, "capa": capa, "metodo": metodo, "estado": "OK",
                                   "detalle": detalle, "segundos": round(time.time() - t, 1)})
                print(f"OK    {nombre}: {detalle}")
            except Exception as e:  # noqa: BLE001
                inventario.append({"fuente": nombre, "capa": capa, "metodo": metodo, "estado": "FALLO",
                                   "detalle": f"{type(e).__name__}: {str(e)[:160]}", "segundos": round(time.time() - t, 1)})
                print(f"FALLO {nombre}: {type(e).__name__}: {str(e)[:160]}")
        run.__name__ = fn.__name__
        return run
    return deco


def get(url, params=None, headers=UA_BOT, timeout=60, **kw):
    """GET respetuoso: si el servidor pide esperar (429), espera y reintenta hasta 4 veces."""
    for intento in range(5):
        r = requests.get(url, params=params, headers=headers, timeout=timeout, **kw)
        if r.status_code == 429 and intento < 4:
            time.sleep(int(r.headers.get("Retry-After", 0)) or 30 * (intento + 1))
            continue
        r.raise_for_status()
        return r


# ---------------- AMENAZA ----------------
@conector("Open-Meteo Archive (ERA5): lluvia diaria 2000-2025 por localidad", "Amenaza", "API")
def lluvia_historica():
    filas = 0
    for loc in LOCALIDADES:
        d = get("https://archive-api.open-meteo.com/v1/archive",
                dict(latitude=loc["lat"], longitude=loc["lon"], start_date="2000-01-01", end_date="2025-12-31",
                     daily="precipitation_sum,temperature_2m_max", timezone="America/Lima")).json()["daily"]
        rows = [{"fecha": f, "lluvia_mm": p, "tmax_c": t} for f, p, t in zip(d["time"], d["precipitation_sum"], d["temperature_2m_max"])]
        guardar(f"open_meteo/lluvia_historica_{loc['id']}.csv", rows, "csv"); filas += len(rows)
        time.sleep(8)
    return f"{filas} filas, {len(LOCALIDADES)} localidades"


@conector("GloFAS reanálisis: caudal diario 1984-2025 ríos Piura y Chira", "Amenaza", "API")
def caudal_historico():
    out = []
    for clave, rio in RIOS.items():
        d = get("https://flood-api.open-meteo.com/v1/flood",
                dict(latitude=rio["lat"], longitude=rio["lon"], daily="river_discharge",
                     start_date="1984-01-01", end_date="2025-12-31")).json()["daily"]
        rows = [{"fecha": f, "caudal_glofas_m3s": q} for f, q in zip(d["time"], d["river_discharge"])]
        guardar(f"glofas/caudal_historico_{clave}.csv", rows, "csv")
        pico = max((r for r in rows if r["caudal_glofas_m3s"] is not None), key=lambda r: r["caudal_glofas_m3s"])
        out.append(f"{clave}: {len(rows)} días, pico {pico['caudal_glofas_m3s']} ({pico['fecha']})")
    return "; ".join(out)


@conector("NOAA CPC: índices Niño semanales 1990-hoy", "Amenaza", "Archivo de texto")
def nino():
    t = get("https://www.cpc.ncep.noaa.gov/data/indices/wksst9120.for").text
    rows = []
    for linea in t.splitlines():
        # Los negativos vienen pegados (p.ej. '24.1-0.2'); split() los perdía y descartaba la semana.
        p = linea.split()[:1] + re.findall(r"-?\d+\.\d+", " ".join(linea.split()[1:]))
        if len(p) == 9 and p[0][:2].isdigit():
            rows.append({"semana": p[0], "nino12_sst": p[1], "nino12_anom": p[2], "nino3_sst": p[3], "nino3_anom": p[4],
                         "nino34_sst": p[5], "nino34_anom": p[6], "nino4_sst": p[7], "nino4_anom": p[8]})
    guardar("noaa/nino_semanal.csv", rows, "csv")
    return f"{len(rows)} semanas; última {rows[-1]['semana']} Niño1+2 {rows[-1]['nino12_anom']} °C"


@conector("NOAA CPC: ONI mensual (índice oficial ENSO)", "Amenaza", "Archivo de texto")
def oni():
    t = get("https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt").text
    rows = [dict(zip(["temporada", "anio", "total", "anom"], l.split())) for l in t.splitlines()[1:] if l.strip()]
    guardar("noaa/oni.csv", rows, "csv")
    return f"{len(rows)} registros; último {rows[-1]}"


@conector("Open-Meteo: pronóstico determinista 16 días (lluvia, prob. de lluvia)", "Amenaza", "API")
def pronostico_det():
    res = {}
    for loc in LOCALIDADES:
        res[loc["id"]] = get("https://api.open-meteo.com/v1/forecast",
                             dict(latitude=loc["lat"], longitude=loc["lon"], forecast_days=16, timezone="America/Lima",
                                  daily="precipitation_sum,precipitation_probability_max,temperature_2m_max")).json()["daily"]
    guardar("open_meteo/pronostico_16d.json", res)
    return f"{len(res)} localidades"


@conector("Open-Meteo Seasonal (ECMWF SEAS5): lluvia a 6 meses", "Amenaza", "API")
def estacional():
    d = get("https://seasonal-api.open-meteo.com/v1/seasonal",
            dict(latitude=-5.19, longitude=-80.63, daily="precipitation_sum", forecast_days=183)).json()
    guardar("open_meteo/estacional_piura.json", d)
    n = len([k for k in d.get("daily", {}) if k.startswith("precipitation")])
    return f"{n} miembros, {len(d.get('daily', {}).get('time', []))} días"


@conector("SENAMHI: avisos meteorológicos (scraping)", "Amenaza", "Scraping HTML")
def senamhi_avisos():
    r = get("https://www.senamhi.gob.pe/?p=aviso-meteorologico", headers=UA_NAV)
    guardar("senamhi/avisos_pagina.html", r.text, "txt")
    titulos = re.findall(r"(Aviso[^<]{5,160})", r.text)
    guardar("senamhi/avisos_titulos.json", list(dict.fromkeys(t.strip() for t in titulos))[:60])
    return f"{len(r.text)} bytes, {len(set(titulos))} textos de aviso"


@conector("SENAMHI: mapa de estaciones (scraping)", "Amenaza", "Scraping HTML/JS")
def senamhi_estaciones():
    r = get("https://www.senamhi.gob.pe/mapas/mapa-estaciones-2/", headers=UA_NAV)
    guardar("senamhi/estaciones_pagina.html", r.text, "txt")
    piura = sorted(set(re.findall(r"PIURA[^\"'<]{0,60}", r.text.upper())))
    cods = sorted(set(re.findall(r"cod(?:igo)?[\"']?\s*[:=]\s*[\"']?(\d{5,9})", r.text, re.I)))
    guardar("senamhi/estaciones_piura_menciones.json", {"menciones": piura[:200], "codigos": cods[:500]})
    return f"{len(piura)} menciones a Piura, {len(cods)} códigos de estación"


# ---------------- EXPOSICIÓN ----------------
def arcgis_listar(base: str) -> list[str]:
    raiz = get(f"{base}?f=json", headers=UA_NAV).json()
    servicios = [f"{s['name']}/{s['type']}" for s in raiz.get("services", [])]
    for carpeta in raiz.get("folders", []):
        try:
            sub = get(f"{base}/{carpeta}?f=json", headers=UA_NAV, timeout=30).json()
            servicios += [f"{s['name']}/{s['type']}" for s in sub.get("services", [])]
        except Exception:  # noqa: BLE001
            pass
    return servicios


@conector("CENEPRED SIGRID: catálogo ArcGIS REST + capas FEN en Piura", "Exposición", "ArcGIS REST")
def sigrid():
    base = "https://sigrid.cenepred.gob.pe/arcgis/rest/services"
    servicios = arcgis_listar(base)
    guardar("cenepred/catalogo_servicios.json", servicios)
    fen = [s for s in servicios if s.upper().startswith("FEN/") or "NINO" in s.upper() or "INUND" in s.upper()]
    descargadas = 0
    s, o, n, e = BBOX_PIURA
    for srv in fen[:8]:
        nombre, tipo = srv.rsplit("/", 1)
        try:
            meta = get(f"{base}/{nombre}/{tipo}?f=json", headers=UA_NAV, timeout=30).json()
            for capa in meta.get("layers", [])[:6]:
                q = get(f"{base}/{nombre}/{tipo}/{capa['id']}/query", headers=UA_NAV, timeout=60, params=dict(
                    where="1=1", geometry=f"{o},{s},{e},{n}", geometryType="esriGeometryEnvelope", inSR=4326,
                    spatialRel="esriSpatialRelIntersects", outFields="*", outSR=4326, f="geojson", resultRecordCount=2000))
                gj = q.json()
                if gj.get("features"):
                    guardar(f"cenepred/{nombre.replace('/', '_')}_{capa['id']}.geojson", gj); descargadas += 1
        except Exception:  # noqa: BLE001
            continue
    return f"{len(servicios)} servicios en catálogo, {len(fen)} relacionados a FEN/inundación, {descargadas} capas con datos en Piura"


@conector("INGEMMET GEOCATMIN: catálogo ArcGIS REST", "Exposición", "ArcGIS REST")
def geocatmin():
    servicios = arcgis_listar("https://geocatmin.ingemmet.gob.pe/arcgis/rest/services")
    guardar("ingemmet/catalogo_servicios.json", servicios)
    peligro = [s for s in servicios if any(k in s.upper() for k in ("PELIGRO", "MASA", "INUND", "GEOHIDRO", "DGAR"))]
    return f"{len(servicios)} servicios; {len(peligro)} de peligros geológicos"


@conector("OpenStreetMap Overpass: salud, colegios, agua y ríos en Piura", "Exposición", "API Overpass")
def overpass():
    s, o, n, e = BBOX_PIURA
    q = f"""[out:json][timeout:90];(
      nwr[amenity~"hospital|clinic|doctors"]({s},{o},{n},{e});
      nwr[amenity=school]({s},{o},{n},{e});
      nwr[man_made~"water_tower|reservoir_covered|water_works|wastewater_plant|storage_tank"]({s},{o},{n},{e});
      nwr[amenity=drinking_water]({s},{o},{n},{e});
      way[waterway~"river|canal|stream"]({s},{o},{n},{e});
    );out center tags;"""
    for url in ("https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter",
                "https://overpass.private.coffee/api/interpreter"):
        try:
            r = requests.post(url, data={"data": q}, headers=UA_NAV, timeout=120)
            r.raise_for_status()
            el = r.json()["elements"]
            guardar("osm/piura_infraestructura.json", el)
            cuenta = {}
            for x in el:
                t = x.get("tags", {})
                k = t.get("amenity") or t.get("man_made") or t.get("waterway") or "otro"
                cuenta[k] = cuenta.get(k, 0) + 1
            return f"{len(el)} elementos vía {url.split('/')[2]}: {cuenta}"
        except Exception:  # noqa: BLE001
            continue
    raise RuntimeError("ningún servidor Overpass respondió")


# ---------------- SERVICIO / VULNERABILIDAD / SALUD ----------------
@conector("datosabiertos.gob.pe: CKAN búsqueda (Sunass, dengue, RENIPRESS, emergencias, Piura agua)", "Varias", "API CKAN")
def ckan():
    res = {}
    for q in ("sunass", "dengue", "renipress", "emergencias indeci", "piura agua", "eps grau", "enfermedad diarreica"):
        r = get("https://www.datosabiertos.gob.pe/api/3/action/package_search", dict(q=q, rows=10), headers=UA_NAV)
        res[q] = [{"titulo": p.get("title"), "organizacion": (p.get("organization") or {}).get("title"),
                   "recursos": [x.get("url") for x in p.get("resources", [])][:5]} for p in r.json()["result"]["results"]]
        time.sleep(1)
    guardar("datos_abiertos/ckan_busquedas.json", res)
    return "; ".join(f"{k}: {len(v)}" for k, v in res.items())


@conector("CDC-MINSA: sala situacional de dengue (scraping)", "Salud", "Scraping HTML")
def cdc():
    r = get("https://www.dge.gob.pe/sala-situacional-dengue/", headers=UA_NAV)
    guardar("cdc/sala_dengue.html", r.text, "txt")
    piura = re.findall(r"PIURA[^<]{0,120}", r.text.upper())
    return f"{len(r.text)} bytes, {len(piura)} menciones a Piura"


@conector("EPS Grau: página de comunicados (scraping)", "Servicio", "Scraping HTML")
def epsgrau():
    r = get("https://www.epsgrau.pe/", headers=UA_NAV)
    guardar("epsgrau/inicio.html", r.text, "txt")
    avisos = re.findall(r"(?:corte|interrupci[oó]n|suspensi[oó]n|restricci[oó]n)[^<]{0,140}", r.text, re.I)
    guardar("epsgrau/avisos_detectados.json", list(dict.fromkeys(a.strip() for a in avisos))[:50])
    return f"{len(avisos)} textos de corte/interrupción detectados"


@conector("ENOSA (Distriluz): cortes programados (scraping)", "Exposición", "Scraping HTML")
def enosa():
    r = get("https://www.distriluz.com.pe/enosa/", headers=UA_NAV)
    guardar("enosa/inicio.html", r.text, "txt")
    cortes = re.findall(r"(?:corte|interrupci[oó]n)[^<]{0,140}", r.text, re.I)
    return f"{len(r.text)} bytes, {len(cortes)} textos de corte"


@conector("ANA SNIRH: observatorio de recursos hídricos (scraping)", "Amenaza", "Scraping HTML")
def snirh():
    r = get("https://snirh.ana.gob.pe/onrh/", headers=UA_NAV)
    guardar("ana/onrh.html", r.text, "txt")
    poechos = re.findall(r"POECHOS[^<]{0,120}", r.text.upper())
    return f"{len(r.text)} bytes, {len(poechos)} menciones a Poechos"


@conector("Sunass: agenda temprana 2025 (PDF de interrupciones)", "Servicio", "Descarga PDF")
def sunass_pdf():
    r = get("https://cdn.www.gob.pe/uploads/document/file/7571174/6428548-anexo-de-la-agenda-temprana-2025.pdf", headers=UA_NAV)
    p = EXT / "sunass" / "anexo_agenda_temprana_2025.pdf"
    p.parent.mkdir(parents=True, exist_ok=True); p.write_bytes(r.content)
    return f"{len(r.content) // 1024} KB"


@conector("INDECI: directiva SISMATE (PDF)", "Gestión del riesgo", "Descarga PDF")
def indeci_pdf():
    r = get("https://cdn.www.gob.pe/uploads/document/file/6123753/5412520-directiva-000003-2024-sec-gral.pdf", headers=UA_NAV)
    p = EXT / "indeci" / "directiva_sismate_2024.pdf"
    p.parent.mkdir(parents=True, exist_ok=True); p.write_bytes(r.content)
    return f"{len(r.content) // 1024} KB"


@conector("CHIRPS v3: listado de productos", "Amenaza", "Descarga directa")
def chirps():
    r = get("https://data.chc.ucsb.edu/products/CHIRPS/v3.0/")
    carpetas = re.findall(r'href="([^"?/][^"]*/)"', r.text)
    guardar("chirps/listado.json", carpetas)
    return f"carpetas: {carpetas[:10]}"


# ================= CONECTORES AMPLIADOS (ANA, SENAMHI GeoServer, CDC PDF, cuenca alta, INEI) =================
def arcgis_query_bbox(url_capa: str, timeout=90) -> dict:
    s, o, n, e = BBOX_PIURA
    return get(f"{url_capa}/query", timeout=timeout, params=dict(
        where="1=1", geometry=f"{o},{s},{e},{n}", geometryType="esriGeometryEnvelope", inSR=4326,
        spatialRel="esriSpatialRelIntersects", outFields="*", outSR=4326, f="geojson", resultRecordCount=2000)).json()


def arcgis_catalogo(base: str) -> tuple[list[str], dict]:
    raiz = get(f"{base}?f=pjson", timeout=90).json()
    servicios, fallos = [f"{s['name']}/{s['type']}" for s in raiz.get("services", [])], {}
    for carpeta in raiz.get("folders", []):
        for _ in range(2):
            try:
                sub = get(f"{base}/{carpeta}?f=pjson", timeout=45).json()
                servicios += [f"{s['name']}/{s['type']}" for s in sub.get("services", [])]
                fallos.pop(carpeta, None)
                break
            except Exception as ex:  # noqa: BLE001
                fallos[carpeta] = f"{type(ex).__name__}: {str(ex)[:100]}"
                time.sleep(3)
        time.sleep(0.5)
    return servicios, fallos


ANA_CLAVES = ("ESTACION", "HIDROM", "PRESA", "REPRESA", "EMBALSE", "POECHOS", "CHIRA", "PIURA", "INUNDA",
              "PUNTOS_CRITICOS_FINAL", "PC_DU_2026", "EMERGENCIAS/", "RIOS_QUEBRADAS", "FAJA", "PELIGRO_INMINENTE",
              "PREDIOS_RURALES", "SEQUIA", "PUBLICO/", "PÚBLICO/")
ANA_EXCLUIR = ("SATELITE", "RIMAC", "ILO", "TUMBES", "CHILLON", "LURIN", "PRESUPUESTO", "LIMITE_", "DEPARTAMENTO",
               "DERECHOSUSOAGUA", "DUA_", "AUTORIZACION", "ACREDISP")  # datos de titulares (personales): se excluyen


@conector("ANA GeoSNIRH ArcGIS REST: catálogo + capas hídricas en Piura", "Amenaza", "ArcGIS REST")
def ana_geosnirh():
    base = "https://geosnirh.ana.gob.pe/server/rest/services"
    servicios, fallos = arcgis_catalogo(base)
    guardar("ana/catalogo_servicios.json", {"servicios": servicios, "carpetas_con_error": fallos})
    elegidos = []
    for srv in servicios:
        nom, tipo = srv.rsplit("/", 1)
        u = nom.upper() + "/"
        if tipo not in ("MapServer", "FeatureServer") or not any(k in u for k in ANA_CLAVES) or any(k in u for k in ANA_EXCLUIR):
            continue
        if tipo == "FeatureServer" and f"{nom}/MapServer" in servicios:
            continue  # misma data que el MapServer
        elegidos.append((nom, tipo))
    resumen, con_datos = [], 0
    for nom, tipo in elegidos[:40]:
        try:
            meta = get(f"{base}/{nom}/{tipo}?f=pjson", timeout=60).json()
        except Exception as ex:  # noqa: BLE001
            resumen.append({"servicio": f"{nom}/{tipo}", "error": str(ex)[:120]}); continue
        for capa in [c for c in meta.get("layers", []) if not c.get("subLayerIds")][:12]:
            reg = {"servicio": f"{nom}/{tipo}", "capa_id": capa["id"], "capa": capa.get("name")}
            try:
                gj = arcgis_query_bbox(f"{base}/{nom}/{tipo}/{capa['id']}")
                n = len(gj.get("features", []))
                reg["features_piura"] = n
                if n:
                    archivo = f"ana/{nom.replace('/', '_')}_{capa['id']}.geojson"
                    gj["_meta"] = {"servicio": f"{nom}/{tipo}", "capa": capa.get("name"), "fuente": base}
                    guardar(archivo, gj); con_datos += 1; reg["archivo"] = archivo
            except Exception as ex:  # noqa: BLE001
                reg["error"] = f"{type(ex).__name__}: {str(ex)[:100]}"
            resumen.append(reg)
            time.sleep(0.7)
    guardar("ana/resumen_capas.json", resumen)
    return (f"{len(servicios)} servicios ({len(fallos)} carpetas con error: {', '.join(fallos)}), "
            f"{len(elegidos)} relevantes, {con_datos} capas con datos en Piura")


SENAMHI_OWS = "https://idesep.senamhi.gob.pe/geoserver/ows"
SENAMHI_TEMAS = {"precipitacion": ("PRECIP", "LLUVIA"), "avisos": ("AVISO",), "hidrologia": ("HIDROL", "CAUDAL", " RIO"),
                 "estaciones": ("ESTACI",), "inundacion": ("INUND",), "quebradas": ("QUEBRADA", "QDRA", "HUAICO")}


def _tema(texto: str) -> list[str]:
    t = " " + texto.upper()
    return [k for k, cl in SENAMHI_TEMAS.items() if any(c in t for c in cl)]


@conector("SENAMHI GeoServer IDESEP: capas WMS/WFS + avisos/quebradas en Piura", "Amenaza", "OGC WMS/WFS")
def senamhi_geoserver():
    import xml.etree.ElementTree as ET
    W, F = "{http://www.opengis.net/wms}", "{http://www.opengis.net/wfs/2.0}"
    r = get(SENAMHI_OWS, params=dict(service="WMS", request="GetCapabilities"), timeout=180)
    capas = []
    for L in ET.fromstring(r.content).iter(f"{W}Layer"):
        if L.find(f"{W}Name") is None:
            continue
        d = {"nombre": L.findtext(f"{W}Name"), "titulo": L.findtext(f"{W}Title"), "abstract": (L.findtext(f"{W}Abstract") or "")[:500]}
        d["temas"] = _tema(" ".join(str(v) for v in d.values()))
        capas.append(d)
    time.sleep(2)
    w = get(SENAMHI_OWS, params=dict(service="WFS", request="GetCapabilities", version="2.0.0"), timeout=180)
    wfs = []
    for ft in ET.fromstring(w.content).iter(f"{F}FeatureType"):
        d = {"nombre": ft.findtext(f"{F}Name"), "titulo": ft.findtext(f"{F}Title"), "abstract": (ft.findtext(f"{F}Abstract") or "")[:300]}
        d["temas"] = _tema(" ".join(str(v) for v in d.values()))
        wfs.append(d)
    guardar("senamhi/geoserver_capas.json", {"wms": capas, "wfs": wfs})
    avisos = sorted(c["nombre"] for c in wfs if re.search(r":aviso\d+$", c["nombre"] or ""))[-15:]
    otros = [c["nombre"] for c in wfs if set(c["temas"]) & {"quebradas", "estaciones", "inundacion", "hidrologia"}][:25]
    s, o, n, e = BBOX_PIURA
    bajadas, detalle = 0, {}
    for nombre in otros + avisos:
        try:
            gj = get(SENAMHI_OWS, timeout=120, params=dict(service="WFS", version="2.0.0", request="GetFeature", typeNames=nombre,
                     outputFormat="application/json", srsName="EPSG:4326", count=3000,
                     bbox=f"{s},{o},{n},{e},urn:ogc:def:crs:EPSG::4326")).json()
            nf = len(gj.get("features", []))
            detalle[nombre] = nf
            if nf:
                gj["_meta"] = {"capa": nombre, "fuente": SENAMHI_OWS}
                guardar(f"senamhi/wfs_{nombre.replace(':', '__')}.geojson", gj); bajadas += 1
        except Exception as ex:  # noqa: BLE001
            detalle[nombre] = f"error {type(ex).__name__}: {str(ex)[:80]}"
        time.sleep(1.5)
    guardar("senamhi/wfs_descargas_piura.json", detalle)
    por_tema = {k: sum(k in c["temas"] for c in capas) for k in SENAMHI_TEMAS}
    return f"{len(capas)} capas WMS ({por_tema}), {len(wfs)} WFS; {bajadas}/{len(detalle)} capas vectoriales con datos en Piura"


@conector("CDC-MINSA: PDF semanal sala situacional dengue (cifras Piura)", "Salud", "Descarga PDF")
def cdc_pdf():
    import io
    import pdfplumber
    url = None
    for se in range(44, 0, -1):
        u = f"https://www.dge.gob.pe/portal/docs/vigilancia/sala/2026/SE{se:02d}/dengue.pdf"
        r = requests.get(u, headers=UA_BOT, timeout=60)
        if r.status_code == 200 and r.content[:4] == b"%PDF":
            url, contenido = u, r.content
            break
        time.sleep(1.5)
    if not url:
        raise RuntimeError("Ningún PDF SE44..SE01 de 2026 disponible con ese patrón")
    p = EXT / "cdc" / f"dengue_2026_SE{se:02d}.pdf"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(contenido)
    lineas = []
    with pdfplumber.open(io.BytesIO(contenido)) as pdf:
        for i, pg in enumerate(pdf.pages):
            for ln in (pg.extract_text() or "").splitlines():
                if "PIURA" in ln.upper():
                    lineas.append({"pagina": i + 1, "linea": ln})
    cifras = []
    for x in lineas:
        nums = re.findall(r"\d[\d.,]*", x["linea"].upper().split("PIURA", 1)[1])
        if nums:
            cifras.append({**x, "numeros": nums})
    guardar(f"cdc/dengue_2026_SE{se:02d}_piura.json", {"url": url, "semana": se, "lineas_piura": lineas, "cifras": cifras})
    return f"SE{se:02d} ({len(contenido)//1024} KB), {len(lineas)} líneas con Piura; ej: {cifras[0]['linea'][:90] if cifras else '-'}"


CUENCA_ALTA = [
    {"id": "CA-HUANCABAMBA", "nombre": "Huancabamba", "lat": -5.24, "lon": -79.45},
    {"id": "CA-CHULUCANAS", "nombre": "Chulucanas/Morropón", "lat": -5.09, "lon": -80.16},
    {"id": "CA-TAMBOGRANDE", "nombre": "Tambogrande", "lat": -4.93, "lon": -80.34},
    {"id": "CA-AYABACA", "nombre": "Ayabaca", "lat": -4.64, "lon": -79.71},
    {"id": "CA-POECHOS", "nombre": "Represa Poechos", "lat": -4.66, "lon": -80.50},
]


@conector("Open-Meteo: lluvia ERA5 2000-2025 + ensemble 15 d en la cuenca alta", "Amenaza", "API")
def cuenca_alta_lluvia():
    filas, hoy = 0, datetime.now().strftime("%Y-%m-%d")
    for loc in CUENCA_ALTA:
        d = get("https://archive-api.open-meteo.com/v1/archive",
                dict(latitude=loc["lat"], longitude=loc["lon"], start_date="2000-01-01", end_date="2025-12-31",
                     daily="precipitation_sum,temperature_2m_max", timezone="America/Lima")).json()["daily"]
        rows = [{"fecha": f, "lluvia_mm": p, "tmax_c": t} for f, p, t in zip(d["time"], d["precipitation_sum"], d["temperature_2m_max"])]
        guardar(f"open_meteo/lluvia_historica_{loc['id']}.csv", rows, "csv")
        filas += len(rows)
        time.sleep(9)
        ens = get("https://ensemble-api.open-meteo.com/v1/ensemble",
                  dict(latitude=loc["lat"], longitude=loc["lon"], daily="precipitation_sum", models="ecmwf_ifs025",
                       forecast_days=15, timezone="America/Lima")).json()
        guardar(f"crudos/{hoy}/lluvia_{loc['id']}.json", ens)
        time.sleep(9)
    guardar("open_meteo/cuenca_alta_puntos.json", CUENCA_ALTA)
    return f"{filas} filas históricas, {len(CUENCA_ALTA)} puntos + ensemble 15 d ({hoy})"


@conector("GloFAS: caudal histórico + ensemble en entrada del Chira / Poechos", "Amenaza", "API")
def glofas_poechos():
    lat0, lon0 = -4.66, -80.50
    pasos = [round(-0.15 + 0.05 * i, 2) for i in range(7)]
    lats = [round(lat0 + a, 3) for a in pasos for _ in pasos]
    lons = [round(lon0 + b, 3) for _ in pasos for b in pasos]
    r = get("https://flood-api.open-meteo.com/v1/flood", dict(latitude=",".join(map(str, lats)), longitude=",".join(map(str, lons)),
            daily="river_discharge", start_date="2023-03-01", end_date="2023-03-31")).json()
    r = r if isinstance(r, list) else [r]
    medias = []
    for la, lo, x in zip(lats, lons, r):
        v = [q for q in x["daily"]["river_discharge"] if q is not None]
        medias.append((sum(v) / len(v) if v else -1, la, lo))
    q, lat, lon = max(medias)
    time.sleep(9)
    d = get("https://flood-api.open-meteo.com/v1/flood", dict(latitude=lat, longitude=lon, daily="river_discharge",
            start_date="1984-01-01", end_date="2025-12-31")).json()["daily"]
    rows = [{"fecha": f, "caudal_glofas_m3s": v} for f, v in zip(d["time"], d["river_discharge"])]
    guardar("glofas/caudal_historico_poechos.csv", rows, "csv")
    time.sleep(9)
    hoy = datetime.now().strftime("%Y-%m-%d")
    ens = get("https://flood-api.open-meteo.com/v1/flood", dict(latitude=lat, longitude=lon, daily="river_discharge",
              ensemble="true", forecast_days=15)).json()
    guardar(f"crudos/{hoy}/glofas_poechos.json", ens)
    guardar("glofas/celda_poechos.json", {"lat": lat, "lon": lon, "media_marzo_2023_m3s": round(q, 1),
                                          "busqueda": "max caudal medio mar-2023 en ±0.15° (paso 0.05°) alrededor de -4.66,-80.50"})
    pico = max((x for x in rows if x["caudal_glofas_m3s"] is not None), key=lambda x: x["caudal_glofas_m3s"])
    return f"celda {lat},{lon} (media mar-2023 {q:.0f} m3/s); {len(rows)} días, pico {pico['caudal_glofas_m3s']} ({pico['fecha']}); ensemble 15 d"


@conector("CENEPRED SIGRID: capas nuevas (no FEN/COEN) con datos en Piura", "Exposición", "ArcGIS REST")
def sigrid_extra():
    base = "https://sigrid.cenepred.gob.pe/arcgis/rest/services"
    cat = json.loads((EXT / "cenepred" / "catalogo_servicios.json").read_text(encoding="utf-8"))
    claves = ("INUND", "LLUVIA", "PRECIP", "HUAICO", "MASA", "NINO", "NIÑO", "PELIGRO", "SUSCEP", "RIESGO", "EMERG", "AGUA")
    excl = ("FEN2023", "TUMBES", "LAMBAYEQUE", "COEN_FEN_2027", "ER_NINO2027")
    excl += ("SAMPLEWORLDCITIES", "FEN/", "SECTORES/")
    elegidos = [s for s in cat if s.endswith("/MapServer") and (any(k in s.upper() for k in claves) or s.startswith("sigrid/"))
                and not any(k in s.upper() for k in excl)]
    resumen, con_datos = [], 0
    for srv in elegidos[:15]:
        nom, tipo = srv.rsplit("/", 1)
        try:
            meta = get(f"{base}/{nom}/{tipo}?f=json", timeout=45).json()
        except Exception as ex:  # noqa: BLE001
            resumen.append({"servicio": srv, "error": str(ex)[:100]})
            continue
        for capa in [c for c in meta.get("layers", []) if not c.get("subLayerIds")][:8]:
            reg = {"servicio": srv, "capa_id": capa["id"], "capa": capa.get("name")}
            try:
                gj = arcgis_query_bbox(f"{base}/{nom}/{tipo}/{capa['id']}")
                reg["features_piura"] = len(gj.get("features", []))
                if reg["features_piura"]:
                    gj["_meta"] = {"servicio": srv, "capa": capa.get("name"), "fuente": base}
                    guardar(f"cenepred/extra_{nom.replace('/', '_')}_{capa['id']}.geojson", gj)
                    con_datos += 1
            except Exception as ex:  # noqa: BLE001
                reg["error"] = f"{type(ex).__name__}: {str(ex)[:80]}"
            resumen.append(reg)
            time.sleep(0.7)
    guardar("cenepred/resumen_extra.json", resumen)
    return f"{len(elegidos)} servicios candidatos ({elegidos[:6]}), {con_datos} capas nuevas con datos en Piura"


@conector("Límites distritales de Piura (geoservidor MINAM / ANA)", "Exposición", "ArcGIS REST")
def limites_distritales():
    notas = {}
    try:
        rb = requests.get("https://geoservidor.minam.gob.pe/robots.txt", headers=UA_BOT, timeout=30)
        if rb.status_code == 200 and re.search(r"Disallow:\s*/\s*$", rb.text, re.M):
            notas["geoservidor_minam"] = "robots.txt: Disallow: / -> no se consulta"
    except Exception as ex:  # noqa: BLE001
        notas["geoservidor_minam"] = f"sin respuesta: {type(ex).__name__}"
    url = "https://geosnirh.ana.gob.pe/server/rest/services/Puntos_Criticos/Limite_Distrital_DU_N_015_2023/MapServer"
    meta = get(f"{url}?f=pjson", timeout=60).json()
    capa = meta["layers"][0]["id"]
    gj = get(f"{url}/{capa}/query", timeout=120, params=dict(where="1=1", outFields="*", outSR=4326, f="geojson",
             geometry="-81.35,-6.4,-79.2,-4.0", geometryType="esriGeometryEnvelope", inSR=4326,
             spatialRel="esriSpatialRelIntersects", resultRecordCount=2000)).json()
    feats = [f for f in gj.get("features", []) if "PIURA" in json.dumps(f.get("properties", {}), ensure_ascii=False).upper()]
    if not feats:
        raise RuntimeError(f"Sin distritos de Piura en {url}; {notas}")
    guardar("inei/limites_distritales_piura.geojson", {"type": "FeatureCollection", "features": feats,
            "_meta": {"fuente": url, "nota": "Límites INEI publicados por ANA (DU 015-2023)", **notas}})
    return f"{len(feats)} distritos de Piura (vía ANA GeoSNIRH; {notas or 'MINAM no consultado'})"


NUEVOS = ["ana_geosnirh", "senamhi_geoserver", "cdc_pdf", "cuenca_alta_lluvia", "glofas_poechos", "sigrid_extra", "limites_distritales"]


def main(solo=None):
    for fn in [lluvia_historica, caudal_historico, nino, oni, pronostico_det, estacional, senamhi_avisos,
               senamhi_estaciones, sigrid, geocatmin, overpass, ckan, cdc, epsgrau, enosa, snirh, sunass_pdf,
               indeci_pdf, chirps, ana_geosnirh, senamhi_geoserver, cdc_pdf, cuenca_alta_lluvia, glofas_poechos,
               sigrid_extra, limites_distritales]:
        if solo and fn.__name__ not in solo:
            continue
        fn()
    previo = EXT / "inventario.json"
    if solo and previo.exists():  # ejecución parcial: conserva las demás fuentes del inventario
        nuevas = {i["fuente"] for i in inventario}
        inventario[:0] = [i for i in json.loads(previo.read_text(encoding="utf-8")).get("fuentes", []) if i["fuente"] not in nuevas]
    guardar("inventario.json", {"fecha": datetime.now(timezone.utc).isoformat(timespec="seconds"), "fuentes": inventario})
    ok = sum(i["estado"] == "OK" for i in inventario)
    print(f"\n{ok}/{len(inventario)} fuentes recolectadas")


if __name__ == "__main__":
    import sys
    main(sys.argv[1:] or None)
