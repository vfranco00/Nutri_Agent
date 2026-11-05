"""Serviço de código de barras (Frente B): mine → cache escopado → Open Food Facts.

O Open Food Facts é sempre falso aqui (`httpx.MockTransport`): nenhum teste sai para a
rede. Os cenários são os do plano: encontrado, não encontrado e tempo esgotado, mais as
defesas do RS-17 (isolamento) e do RS-18 (plausibilidade) sobre uma fonte que é wiki.
"""

import httpx
import pytest

from app.models.food_cache import FoodCache
from app.models.user import User
from app.services import openfoodfacts as off

CODIGO = "7891000100103"


def _produto(kcal=250, proteina=8, carbo=40, gordura=5, unidade="g", nome="Biscoito Maria"):
    return {
        "status": 1,
        "code": CODIGO,
        "product": {
            "code": CODIGO,
            "product_name": nome,
            "product_quantity_unit": unidade,
            "nutriments": {
                "energy-kcal_100g": kcal,
                "proteins_100g": proteina,
                "carbohydrates_100g": carbo,
                "fat_100g": gordura,
            },
        },
    }


class OffFalso:
    """Conta as chamadas e responde o que o teste mandar."""

    def __init__(self, resposta=None, status=200, erro=None):
        self.resposta = resposta
        self.status = status
        self.erro = erro
        self.chamadas = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.chamadas.append(request)
        if self.erro is not None:
            raise self.erro
        return httpx.Response(self.status, json=self.resposta or {"status": 0})


@pytest.fixture
def off_falso(monkeypatch):
    def _instalar(**kwargs):
        falso = OffFalso(**kwargs)
        monkeypatch.setattr(
            off,
            "_novo_cliente",
            lambda: httpx.Client(transport=httpx.MockTransport(falso.handler)),
        )
        return falso

    return _instalar


def _usuario(db, email="a@example.com"):
    user = User(email=email, hashed_password="x", full_name="Teste")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_codigo_valido_aceita_so_8_a_14_digitos():
    assert off.CODIGO_VALIDO.match("12345678")
    assert off.CODIGO_VALIDO.match("12345678901234")
    for ruim in ("1234567", "123456789012345", "abc12345", "../12345678", "1234 5678"):
        assert not off.CODIGO_VALIDO.match(ruim)


def test_produto_encontrado_vira_opcao_cacheada(db_session, off_falso):
    falso = off_falso(resposta=_produto())
    user = _usuario(db_session)

    opcao = off.buscar_por_codigo(db_session, user.id, CODIGO)

    assert opcao.kcal_per_base_unit == 2.5
    assert opcao.protein_per_base_unit == 0.08
    assert opcao.carbs_per_base_unit == 0.4
    assert opcao.fat_per_base_unit == 0.05
    assert opcao.base_unit == "g"
    assert opcao.name == "Biscoito Maria"
    assert opcao.source == "openfoodfacts"
    assert opcao.is_estimate is True
    assert opcao.food_ref.startswith("cache:")

    linha = db_session.query(FoodCache).one()
    assert linha.off_product_id == CODIGO
    assert linha.created_by_user_id == user.id
    assert linha.source == "openfoodfacts"
    assert opcao.food_ref == f"cache:{linha.id}"
    # Só o código vai para a URL; nada do usuário.
    assert CODIGO in str(falso.chamadas[0].url)


def test_segunda_leitura_vem_do_cache_sem_rede(db_session, off_falso):
    falso = off_falso(resposta=_produto())
    user = _usuario(db_session)

    primeira = off.buscar_por_codigo(db_session, user.id, CODIGO)
    segunda = off.buscar_por_codigo(db_session, user.id, CODIGO)

    assert primeira.food_ref == segunda.food_ref
    assert len(falso.chamadas) == 1
    assert db_session.query(FoodCache).count() == 1


@pytest.mark.parametrize(
    "status,resposta",
    [(404, {"status": 0, "status_verbose": "product not found"}), (200, {"status": 0})],
)
def test_produto_inexistente_levanta_nao_encontrado(db_session, off_falso, status, resposta):
    off_falso(status=status, resposta=resposta)
    user = _usuario(db_session)

    with pytest.raises(off.BarcodeNotFound):
        off.buscar_por_codigo(db_session, user.id, CODIGO)
    assert db_session.query(FoodCache).count() == 0


def test_produto_sem_kcal_levanta_nao_encontrado(db_session, off_falso):
    resposta = _produto()
    del resposta["product"]["nutriments"]["energy-kcal_100g"]
    off_falso(resposta=resposta)
    user = _usuario(db_session)

    with pytest.raises(off.BarcodeNotFound):
        off.buscar_por_codigo(db_session, user.id, CODIGO)


def test_tempo_esgotado_levanta_indisponivel(db_session, off_falso):
    off_falso(erro=httpx.ReadTimeout("lento"))
    user = _usuario(db_session)

    with pytest.raises(off.BarcodeUnavailable):
        off.buscar_por_codigo(db_session, user.id, CODIGO)
    assert db_session.query(FoodCache).count() == 0


def test_erro_5xx_levanta_indisponivel(db_session, off_falso):
    off_falso(status=503, resposta={})
    user = _usuario(db_session)

    with pytest.raises(off.BarcodeUnavailable):
        off.buscar_por_codigo(db_session, user.id, CODIGO)


def test_tempo_limite_e_5_segundos():
    assert off.OFF_BARCODE_TIMEOUT_SECONDS == 5.0


@pytest.mark.parametrize("kcal", [5000, 0, -10, "abc"])
def test_kcal_implausivel_nao_grava(db_session, off_falso, kcal):
    off_falso(resposta=_produto(kcal=kcal))
    user = _usuario(db_session)

    with pytest.raises(off.BarcodeNotFound):
        off.buscar_por_codigo(db_session, user.id, CODIGO)
    assert db_session.query(FoodCache).count() == 0


def test_macro_fora_da_faixa_vira_none(db_session, off_falso):
    off_falso(resposta=_produto(proteina=180, carbo=-3, gordura="x"))
    user = _usuario(db_session)

    opcao = off.buscar_por_codigo(db_session, user.id, CODIGO)

    assert opcao.protein_per_base_unit is None
    assert opcao.carbs_per_base_unit is None
    assert opcao.fat_per_base_unit is None


def test_bebida_em_ml(db_session, off_falso):
    off_falso(resposta=_produto(kcal=42, unidade="ml", nome="Refrigerante"))
    user = _usuario(db_session)

    opcao = off.buscar_por_codigo(db_session, user.id, CODIGO)

    assert opcao.base_unit == "ml"
    assert opcao.kcal_per_base_unit == 0.42
    assert "ml" in opcao.allowed_units


def test_nome_ausente_ou_sujo_e_saneado(db_session, off_falso):
    off_falso(resposta=_produto(nome="Bis\x00coito\n" + "x" * 300))
    user = _usuario(db_session)

    opcao = off.buscar_por_codigo(db_session, user.id, CODIGO)

    assert "\x00" not in opcao.name and "\n" not in opcao.name
    assert len(opcao.name) <= 120


def test_produto_sem_nome_usa_codigo(db_session, off_falso):
    off_falso(resposta=_produto(nome=""))
    user = _usuario(db_session)

    assert off.buscar_por_codigo(db_session, user.id, CODIGO).name == f"Produto {CODIGO}"


def test_cache_de_outro_usuario_nao_e_lido(db_session, off_falso):
    falso = off_falso(resposta=_produto())
    a = _usuario(db_session, "a@example.com")
    b = _usuario(db_session, "b@example.com")

    opcao_a = off.buscar_por_codigo(db_session, a.id, CODIGO)
    opcao_b = off.buscar_por_codigo(db_session, b.id, CODIGO)

    assert opcao_a.food_ref != opcao_b.food_ref
    assert len(falso.chamadas) == 2
    donos = {l.created_by_user_id for l in db_session.query(FoodCache).all()}
    assert donos == {a.id, b.id}


def test_cache_por_codigo_nao_casa_com_resolve_por_nome(db_session, off_falso):
    """A linha do código usa `barcode:<code>` como chave, e não o nome do produto. Um
    produto chamado "Leite" não pode virar a resposta do resolve de "leite"."""
    off_falso(resposta=_produto(nome="Leite"))
    user = _usuario(db_session)

    off.buscar_por_codigo(db_session, user.id, CODIGO)

    linha = db_session.query(FoodCache).one()
    assert linha.name_normalized == f"barcode:{CODIGO}"
