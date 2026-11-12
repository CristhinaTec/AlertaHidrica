"""Compara el motor Python con la salida del motor TS.
golden_ts.json se generó ejecutando web/src/lib/semaforo.ts con node (type stripping) sobre los 3 escenarios."""
import json
import math
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from semaforo import evaluar  # noqa: E402
from escenarios import ESCENARIOS, construir_localidades, construir_plantas, planta_de  # noqa: E402

GOLD = json.loads((Path(__file__).parent / "golden_ts.json").read_text(encoding="utf-8"))
CASOS = [(e, l) for e in ESCENARIOS for l in construir_localidades(e)]


@pytest.mark.parametrize("esc,loc", CASOS, ids=[f"{e['id']}-{l.id}" for e, l in CASOS])
def test_igual_que_ts(esc, loc):
    r = evaluar(loc, planta_de(loc, construir_plantas(esc)), esc["amenaza"])
    g = GOLD[esc["id"]][loc.id]
    assert r["nivel"] == g["nivel"]
    assert r["ruta"] == g["ruta"]
    assert r["corteEstimadoH"] == g["corte"]
    assert r["cisternas"] == g["cisternas"]
    assert r["deficitH"] == pytest.approx(g["deficitH"], abs=1e-3)
    if g["autonomiaH"] is None:
        assert math.isinf(r["autonomiaH"])
    else:
        assert r["autonomiaH"] == pytest.approx(g["autonomiaH"], abs=1e-3)


def test_reglas_yaml_igual_a_ts():
    from semaforo import R
    assert R["caudal"] == {"amarillo": 900, "naranja": 1290, "rojo": 1900}
    assert R["perdidasRed"] == 0.35
    assert R["cisterna"] == {"capacidadM3": 20, "viajesPorDia": 4, "fraccionPrioritaria": 0.15}
