"""Rota `GET /diary/foods/barcode/{code}` (Frente B).

Grátis em todos os planos: o teste da cota esgotada é o que trava isso. O Open Food Facts
é sempre falso.
"""

from pathlib import Path

import httpx
import pytest

from app.core.quotas import log_usage
from app.models.food_cache import FoodCache
from app.models.subscription import UsageEvent
from app.services import openfoodfacts as off
from tests.diary_helpers import criar, usuario

CODIGO = "7891000100103"
URL = f"/diary/foods/barcode/{CODIGO}"


def _produto(kcal=250):
    return {
        "status": 1,
        "product": {
            "code": CODIGO,
            "product_name": "Biscoito Maria",
            "product_quantity_unit": "g",
            "nutriments": {"energy-kcal_100g": kcal, "proteins_100g": 8},
        },
    }


@pytest.fixture
def off_responde(monkeypatch):
    chamadas = []

    def _instalar(*, status=200, corpo=None, erro=None):
        def handler(request):
            chamadas.append(request)
            if erro is not None:
                raise erro
            return httpx.Response(status, json=corpo if corpo is not None else {"status": 0})

        monkeypatch.setattr(
            off, "_novo_cliente", lambda: httpx.Client(transport=httpx.MockTransport(handler))
        )
        return chamadas

    return _instalar


def test_encontrado_devolve_food_option(make_user, off_responde):
    off_responde(corpo=_produto())
    cli = make_user()

    res = cli.get(URL)

    assert res.status_code == 200, res.text
    corpo = res.json()
    assert corpo["food_ref"].startswith("cache:")
    assert corpo["kcal_per_base_unit"] == 2.5
    assert corpo["source"] == "openfoodfacts"
    assert corpo["is_estimate"] is True


def test_food_ref_devolvido_funciona_no_post_diary(make_user, off_responde):
    off_responde(corpo=_produto())
    cli = make_user()

    food_ref = cli.get(URL).json()["food_ref"]
    res = criar(cli, food_ref=food_ref, quantity=30, unit="g")

    assert res.status_code in (200, 201), res.text


def test_nao_encontrado_devolve_404_sem_repetir_o_codigo(make_user, off_responde):
    off_responde(status=404, corpo={"status": 0})
    cli = make_user()

    res = cli.get(URL)

    assert res.status_code == 404
    assert res.json()["detail"]["code"] == "FOOD_NOT_FOUND"
    assert CODIGO not in res.text


def test_tempo_esgotado_devolve_503(make_user, off_responde):
    off_responde(erro=httpx.ConnectTimeout("lento"))
    cli = make_user()

    res = cli.get(URL)

    assert res.status_code == 503
    assert res.json()["detail"]["code"] == "BARCODE_UNAVAILABLE"


@pytest.mark.parametrize("ruim", ["abc12345", "1234567", "123456789012345", "1234567a"])
def test_codigo_invalido_da_422_sem_rede(make_user, off_responde, ruim):
    chamadas = off_responde(corpo=_produto())
    cli = make_user()

    res = cli.get(f"/diary/foods/barcode/{ruim}")

    assert res.status_code == 422
    assert chamadas == []


def test_gratis_mesmo_com_cota_de_resolve_esgotada(make_user, off_responde, db_session):
    off_responde(corpo=_produto())
    cli = make_user(plan="starter")
    user = usuario(db_session, "user@example.com")
    for _ in range(10):
        log_usage(db_session, user.id, "diary_food_resolve")
    eventos_antes = db_session.query(UsageEvent).count()

    res = cli.get(URL)

    assert res.status_code == 200, res.text
    db_session.expire_all()
    assert db_session.query(UsageEvent).count() == eventos_antes


def test_isolamento_entre_usuarios(make_user, off_responde, db_session):
    off_responde(corpo=_produto())
    cli_a = make_user(email="a@example.com")
    cli_b = make_user(email="b@example.com")

    ref_a = cli_a.get(URL).json()["food_ref"]

    # B com a OFF fora do ar: não pode receber a linha de A como se fosse dele.
    off_responde(erro=httpx.ReadTimeout("lento"))
    res_b = cli_b.get(URL)
    assert res_b.status_code == 503

    # E o food_ref de A não vale para B no POST /diary.
    assert criar(cli_b, food_ref=ref_a, quantity=30, unit="g").status_code == 404

    a = usuario(db_session, "a@example.com")
    assert {l.created_by_user_id for l in db_session.query(FoodCache).all()} == {a.id}


def test_exige_login(client):
    assert client.get(URL).status_code == 401


def test_rs13_router_nao_importa_food_cache():
    router = Path(__file__).resolve().parents[1] / "app" / "routers" / "diary_foods.py"
    texto = router.read_text()
    # A docstring do módulo já cita o nome para explicar a regra; o que conta é o uso.
    assert "models.food_cache" not in texto
    assert "query(FoodCache" not in texto
