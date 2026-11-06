"""Mapeamento da OFF: kcal conferida contra kJ, líquido em ml, tamanhos da embalagem.

Os fixtures de `tests/fixtures/` são recortes reais da resposta da OFF para o Monster
Mango Loco. O do Brasil (0070847033301, o do relato) traz kcal e macros por PORÇÃO de
200 ml nas colunas `_100g` e o kJ por 100 ml: 100 kcal / 26 g carbo contra 214 kJ.
"""

import json
from pathlib import Path

import httpx
import pytest

from app.models.food_cache import FoodCache
from app.models.user import User
from app.services import openfoodfacts as off

FIXTURES = Path(__file__).parent / "fixtures"
BR_ERRADO = "0070847033301"
AU = "9342866000635"
BR_CERTO = "0708470333016"


def _fixture(nome: str) -> dict:
    return json.loads((FIXTURES / nome).read_text())


@pytest.fixture
def off_responde(monkeypatch):
    def _instalar(corpo: dict):
        chamadas = []

        def handler(request):
            chamadas.append(request)
            return httpx.Response(200, json=corpo)

        monkeypatch.setattr(
            off, "_novo_cliente", lambda: httpx.Client(transport=httpx.MockTransport(handler))
        )
        return chamadas

    return _instalar


def _usuario(db):
    user = User(email="a@example.com", hashed_password="x", full_name="Teste")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _produto(code="7891000100103", **campos):
    return {"status": 1, "code": code, "product": {"code": code, "product_name": "X", **campos}}


def test_mango_loco_br_kcal_e_macros_por_100ml(db_session, off_responde):
    off_responde(_fixture("off_monster_mango_loco_br_0070847033301.json"))
    user = _usuario(db_session)

    o = off.buscar_por_codigo(db_session, user.id, BR_ERRADO)

    assert o.base_unit == "ml"
    # 100 kcal era por porção de 200 ml (214 kJ por 100 ml confere): 50 kcal por 100 ml
    assert o.kcal_per_base_unit * 100 == pytest.approx(50.0, abs=0.1)
    assert o.carbs_per_base_unit * 100 == pytest.approx(13, abs=0.1)
    assert o.protein_per_base_unit is None  # o OFF não informa
    assert o.fat_per_base_unit is None
    assert "ml" in o.allowed_units


def test_mango_loco_br_porcao_e_lata(db_session, off_responde):
    off_responde(_fixture("off_monster_mango_loco_br_0070847033301.json"))
    user = _usuario(db_session)

    o = off.buscar_por_codigo(db_session, user.id, BR_ERRADO)

    assert [(p.label, p.quantity) for p in o.portions] == [("Porção", 200.0), ("Lata", 473.0)]


def test_mango_loco_au_consistente_nao_e_alterado_e_zero_explicito_fica_zero(
    db_session, off_responde
):
    off_responde(_fixture("off_monster_mango_loco_au_9342866000635.json"))
    user = _usuario(db_session)

    o = off.buscar_por_codigo(db_session, user.id, AU)

    assert o.base_unit == "ml"
    assert o.kcal_per_base_unit == 0.5
    assert o.carbs_per_base_unit == 0.13
    assert o.protein_per_base_unit == 0.0  # 0 explícito no OFF não vira "—"
    assert o.fat_per_base_unit == 0.0
    assert [(p.label, p.quantity) for p in o.portions] == [("Lata", 500.0)]


def test_mango_loco_br_dados_certos_por_100ml(db_session, off_responde):
    off_responde(_fixture("off_monster_mango_loco_br_0708470333016.json"))
    user = _usuario(db_session)

    o = off.buscar_por_codigo(db_session, user.id, BR_CERTO)

    assert o.base_unit == "ml"
    assert o.kcal_per_base_unit == pytest.approx(0.416)
    assert o.carbs_per_base_unit == pytest.approx(0.0992)
    assert [(p.label, p.quantity) for p in o.portions] == [("Porção", 250.0), ("Lata", 473.0)]


def test_solido_continua_em_gramas(db_session, off_responde):
    off_responde(
        _produto(
            quantity="200 g",
            categories_tags=["en:snacks"],
            nutriments={
                "energy-kcal_100g": 500,
                "energy-kj_100g": 2092,
                "proteins_100g": 6,
                "carbohydrates_100g": 60,
                "fat_100g": 25,
            },
        )
    )
    user = _usuario(db_session)

    o = off.buscar_por_codigo(db_session, user.id, "7891000100103")

    assert o.base_unit == "g"
    assert o.kcal_per_base_unit == 5.0
    assert [(p.label, p.quantity) for p in o.portions] == [("Embalagem", 200.0)]


def test_po_de_bebida_em_gramas_continua_solido_mesmo_com_categoria_de_bebida(
    db_session, off_responde
):
    off_responde(
        _produto(
            quantity="400 g",
            categories_tags=["en:beverages"],
            nutriments={"energy-kcal_100g": 380},
        )
    )
    user = _usuario(db_session)
    assert off.buscar_por_codigo(db_session, user.id, "7891000100103").base_unit == "g"


def test_bebida_so_pela_categoria_vira_ml(db_session, off_responde):
    off_responde(
        _produto(categories_tags=["en:beverages", "en:sodas"], nutriments={"energy-kcal_100g": 40})
    )
    user = _usuario(db_session)
    assert off.buscar_por_codigo(db_session, user.id, "7891000100103").base_unit == "ml"


def test_garrafa_de_1_5_litro(db_session, off_responde):
    off_responde(_produto(quantity="1,5 L", nutriments={"energy-kcal_100g": 40}))
    user = _usuario(db_session)
    o = off.buscar_por_codigo(db_session, user.id, "7891000100103")
    assert o.base_unit == "ml"
    assert [(p.label, p.quantity) for p in o.portions] == [("Garrafa", 1500.0)]


def test_so_valores_por_porcao_converte_para_100(db_session, off_responde):
    off_responde(
        _produto(
            quantity="473 ml",
            serving_quantity=250,
            nutriments={
                "energy-kcal_serving": 100,
                "carbohydrates_serving": 25,
                "proteins_serving": 0,
                "fat_serving": 0,
            },
        )
    )
    user = _usuario(db_session)

    o = off.buscar_por_codigo(db_session, user.id, "7891000100103")

    assert o.kcal_per_base_unit == pytest.approx(0.4)
    assert o.carbs_per_base_unit == pytest.approx(0.1)
    assert o.protein_per_base_unit == 0.0


def test_so_kj_converte_para_kcal_e_nunca_usa_kj_como_kcal(db_session, off_responde):
    off_responde(_produto(quantity="300 ml", nutriments={"energy_100g": 418.4}))
    user = _usuario(db_session)

    o = off.buscar_por_codigo(db_session, user.id, "7891000100103")

    assert o.kcal_per_base_unit == pytest.approx(1.0)  # 100 kcal/100 ml, não 418


def test_kcal_inconsistente_sem_explicacao_usa_kj_e_descarta_macros(db_session, off_responde):
    off_responde(
        _produto(
            nutriments={
                "energy-kcal_100g": 300,
                "energy-kj_100g": 418.4,
                "carbohydrates_100g": 70,
                "proteins_100g": 1,
                "fat_100g": 1,
            }
        )
    )
    user = _usuario(db_session)

    o = off.buscar_por_codigo(db_session, user.id, "7891000100103")

    assert o.kcal_per_base_unit == pytest.approx(1.0)
    assert o.carbs_per_base_unit is None


def test_linha_antiga_do_cache_e_reescrita_na_proxima_leitura(db_session, off_responde):
    """O caso do relato: linha gravada pela versão antiga (100 g, 1 kcal/g, 0,26 carbo)."""
    chamadas = off_responde(_fixture("off_monster_mango_loco_br_0070847033301.json"))
    user = _usuario(db_session)
    velha = FoodCache(
        name="Energético Mango Loco",
        name_normalized=f"barcode:{BR_ERRADO}",
        unit_type="g",
        calories_per_unit=1.0,
        source="openfoodfacts",
        created_by_user_id=user.id,
        off_product_id=BR_ERRADO,
        carbs_per_base_unit=0.26,
    )
    db_session.add(velha)
    db_session.commit()
    id_antigo = velha.id

    o = off.buscar_por_codigo(db_session, user.id, BR_ERRADO)

    assert o.food_ref == f"cache:{id_antigo}"
    assert o.base_unit == "ml"
    assert o.kcal_per_base_unit * 100 == pytest.approx(50.0, abs=0.1)
    assert db_session.query(FoodCache).count() == 1
    assert len(chamadas) == 1

    # e a leitura seguinte já sai do cache novo, sem rede
    off.buscar_por_codigo(db_session, user.id, BR_ERRADO)
    assert len(chamadas) == 1
