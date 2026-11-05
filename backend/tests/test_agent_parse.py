"""Frente G: `POST /agent/parse` (Agente Nuvi que registra).

O Gemini é sempre falso aqui (`call_gemini_parts` substituído por monkeypatch). Os testes
fixam o contrato do plano `docs/superpowers/plans/2026-11-05-nuvi-agente.md`: o agente lê,
casa com a TACO, conta UMA vez na cota `diary_food_resolve` e não grava nada no diário.
"""

import base64
import json

import pytest

from app.models.diary import DiaryEntry
from app.models.subscription import UsageEvent
from app.schemas.agent import ItemExtraido
from app.services import agent_parse as svc
from app.services import diary_foods
from tests.diary_helpers import hoje, semear_catalogo

PNG_1PX = base64.b64encode(
    bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
        "0000000d4944415478da63f8ffff3f0005fe02fea7d6a4c00000000049454e44ae426082"
    )
).decode()


@pytest.fixture(autouse=True)
def _disjuntor_limpo():
    diary_foods.reset_disjuntor()
    yield
    diary_foods.reset_disjuntor()


class GeminiFalso:
    def __init__(self, resposta):
        self.resposta = resposta
        self.chamadas: list[list[dict]] = []

    def __call__(self, parts, timeout=None):
        self.chamadas.append(parts)
        if self.resposta is None or isinstance(self.resposta, str):
            return self.resposta
        return json.dumps(self.resposta)


def gemini(monkeypatch, resposta) -> GeminiFalso:
    falso = GeminiFalso(resposta)
    monkeypatch.setattr("app.services.agent_parse.call_gemini_parts", falso)
    return falso


DOIS_ITENS = {
    "meal_slot": "almoco",
    "items": [
        {"name": "Ovo", "quantity": 2, "unit": "un"},
        {"name": "Pão francês", "quantity": 1, "unit": "un"},
    ],
}


def usos(db, event_type="diary_food_resolve"):
    return db.query(UsageEvent).filter(UsageEvent.event_type == event_type).count()


# ======================================================================================
# Serviço
# ======================================================================================


def test_decodificar_imagem_aceita_png_com_prefixo_data():
    dados, mime = svc.decodificar_imagem(f"data:image/png;base64,{PNG_1PX}")
    assert mime == "image/png"
    assert dados.startswith(b"\x89PNG")


def test_decodificar_imagem_grande_demais():
    grande = base64.b64encode(b"\xff\xd8\xff" + b"0" * svc.MAX_IMAGE_BYTES).decode()
    with pytest.raises(svc.ImagemGrande):
        svc.decodificar_imagem(grande)


@pytest.mark.parametrize("lixo", ["nao e base64 !!!", base64.b64encode(b"texto").decode()])
def test_decodificar_imagem_invalida(lixo):
    with pytest.raises(svc.ImagemInvalida):
        svc.decodificar_imagem(lixo)


def test_extrair_itens_descarta_item_invalido(monkeypatch, db_session):
    gemini(
        monkeypatch,
        {
            "meal_slot": "jantar",
            "items": [
                {"name": "Ovo", "quantity": 2, "unit": "un"},
                {"name": "Arroz", "quantity": -1, "unit": "g"},
                {"name": "Feijão", "quantity": 1, "unit": "kg"},
                {"name": "123", "quantity": 1, "unit": "g"},
            ],
        },
    )
    extracao, respondeu = svc.extrair_itens(db_session, "comi", None)
    assert respondeu is True
    assert extracao.meal_slot == "jantar"
    assert [i.name for i in extracao.items] == ["Ovo"]


def test_extrair_itens_resposta_que_nao_e_json(monkeypatch, db_session):
    gemini(monkeypatch, "Claro! Você comeu ovos.")
    extracao, respondeu = svc.extrair_itens(db_session, "comi ovos", None)
    assert respondeu is True
    assert extracao.items == []


def test_extrair_itens_limita_quantidade_de_itens(monkeypatch, db_session):
    gemini(
        monkeypatch,
        {"items": [{"name": f"Ovo {i}", "quantity": 1, "unit": "un"} for i in range(30)]},
    )
    extracao, _ = svc.extrair_itens(db_session, "muita coisa", None)
    assert len(extracao.items) == svc.MAX_ITENS


def test_extrair_itens_gemini_fora_levanta(monkeypatch, db_session):
    gemini(monkeypatch, None)
    with pytest.raises(svc.AgenteIndisponivel):
        svc.extrair_itens(db_session, "comi ovos", None)


def test_extrair_itens_manda_a_foto_como_inline_data(monkeypatch, db_session):
    falso = gemini(monkeypatch, DOIS_ITENS)
    svc.extrair_itens(db_session, None, (b"\x89PNG...", "image/png"))
    partes = falso.chamadas[0]
    inline = [p for p in partes if "inline_data" in p]
    assert inline and inline[0]["inline_data"]["mime_type"] == "image/png"


def test_prompt_traz_o_texto_delimitado_e_os_nomes_do_catalogo():
    prompt = svc.montar_prompt("comi <<<2 ovos>>>", ["Ovo", "Pão francês"])
    assert "<<<comi 2 ovos>>>" in prompt
    assert "Pão francês" in prompt


def test_casar_item_exato_e_alta(db_session):
    semear_catalogo(db_session)
    item = svc.casar_item(db_session, 1, ItemExtraido(name="ovo", quantity=2, unit="un"))
    assert item.confidence == "alta"
    assert item.food.food_ref == "catalog:ovo-un"
    assert (item.quantity, item.unit) == (2, "un")
    assert item.alternatives == []


def test_casar_item_unidade_que_o_alimento_nao_aceita_vira_baixa(db_session):
    semear_catalogo(db_session)
    item = svc.casar_item(db_session, 1, ItemExtraido(name="Ovo", quantity=2, unit="xicara"))
    assert item.confidence == "baixa"
    assert item.food.food_ref == "catalog:ovo-un"
    assert item.unit in item.food.allowed_units
    assert item.quantity == 1


def test_casar_item_parecido_vem_baixa_com_alternativas(db_session):
    semear_catalogo(db_session)
    item = svc.casar_item(
        db_session, 1, ItemExtraido(name="Tapioca de frango desfiado", quantity=1, unit="un")
    )
    assert item.confidence == "baixa"
    assert item.food is not None
    assert 1 <= len(item.alternatives) <= 5
    assert all("tapioca" in a.name.lower() for a in item.alternatives)


def test_casar_item_sem_correspondencia(db_session):
    semear_catalogo(db_session)
    item = svc.casar_item(db_session, 1, ItemExtraido(name="Xablau quântico", quantity=1, unit="g"))
    assert item.confidence == "baixa"
    assert item.food is None
    assert item.alternatives == []


# ======================================================================================
# Rota
# ======================================================================================


def test_texto_com_dois_itens(monkeypatch, make_user, db_session):
    semear_catalogo(db_session)
    cli = make_user()
    falso = gemini(monkeypatch, DOIS_ITENS)

    res = cli.post(
        "/agent/parse",
        json={"text": "comi 2 ovos e pão francês", "date": hoje().isoformat()},
    )

    assert res.status_code == 200, res.text
    corpo = res.json()
    assert corpo["meal_slot"] == "almoco"
    assert corpo["date"] == hoje().isoformat()
    assert [i["food"]["food_ref"] for i in corpo["items"]] == [
        "catalog:ovo-un",
        "catalog:pao-frances-un",
    ]
    assert [i["confidence"] for i in corpo["items"]] == ["alta", "alta"]
    assert corpo["items"][0]["quantity"] == 2
    assert len(falso.chamadas) == 1
    assert usos(db_session) == 1
    assert db_session.query(DiaryEntry).count() == 0


def test_item_sem_taco_vem_baixa(monkeypatch, make_user, db_session):
    semear_catalogo(db_session)
    cli = make_user()
    gemini(
        monkeypatch,
        {"items": [{"name": "Xablau quântico", "quantity": 1, "unit": "g"}]},
    )
    res = cli.post("/agent/parse", json={"text": "comi xablau", "date": hoje().isoformat()})
    assert res.status_code == 200, res.text
    item = res.json()["items"][0]
    assert item["confidence"] == "baixa"
    assert item["food"] is None
    assert item["name"] == "Xablau quântico"


def test_meal_slot_da_requisicao_quando_texto_nao_diz(monkeypatch, make_user, db_session):
    semear_catalogo(db_session)
    cli = make_user()
    gemini(monkeypatch, {"meal_slot": None, "items": DOIS_ITENS["items"]})
    res = cli.post(
        "/agent/parse",
        json={"text": "2 ovos", "date": hoje().isoformat(), "meal_slot": "cafe_da_manha"},
    )
    assert res.json()["meal_slot"] == "cafe_da_manha"


def test_cota_esgotada_429(monkeypatch, make_user, db_session):
    cli = make_user(plan="starter")
    from app.models.user import User

    u = db_session.query(User).first()
    for _ in range(10):
        db_session.add(UsageEvent(user_id=u.id, event_type="diary_food_resolve"))
    db_session.commit()
    falso = gemini(monkeypatch, DOIS_ITENS)

    res = cli.post("/agent/parse", json={"text": "2 ovos", "date": hoje().isoformat()})

    assert res.status_code == 429, res.text
    detalhe = res.json()["detail"]
    assert detalhe["code"] == "PLAN_LIMIT_REACHED"
    assert detalhe["upgrade_url"] == "/assinatura"
    assert "Starter" in detalhe["message"]
    assert detalhe["limit"] == 10
    assert falso.chamadas == []


def test_imagem_grande_413(monkeypatch, make_user, db_session):
    cli = make_user()
    falso = gemini(monkeypatch, DOIS_ITENS)
    grande = base64.b64encode(b"\xff\xd8\xff" + b"0" * svc.MAX_IMAGE_BYTES).decode()

    res = cli.post("/agent/parse", json={"image_base64": grande, "date": hoje().isoformat()})

    assert res.status_code == 413, res.text
    assert res.json()["detail"]["code"] == "IMAGE_TOO_LARGE"
    assert falso.chamadas == []
    assert usos(db_session) == 0


def test_foto_valida_e_lida(monkeypatch, make_user, db_session):
    semear_catalogo(db_session)
    cli = make_user()
    gemini(monkeypatch, DOIS_ITENS)
    res = cli.post(
        "/agent/parse",
        json={"image_base64": f"data:image/png;base64,{PNG_1PX}", "date": hoje().isoformat()},
    )
    assert res.status_code == 200, res.text
    assert len(res.json()["items"]) == 2


def test_imagem_invalida_422(monkeypatch, make_user):
    cli = make_user()
    gemini(monkeypatch, DOIS_ITENS)
    res = cli.post(
        "/agent/parse", json={"image_base64": "isto nao e foto", "date": hoje().isoformat()}
    )
    assert res.status_code == 422


@pytest.mark.parametrize(
    "corpo",
    [
        {},
        {"text": "   "},
        {"text": "a" * 501},
        {"text": "comi\x00ovo"},
        {"text": "ovo", "user_id": 2},
    ],
)
def test_corpo_invalido_422(monkeypatch, make_user, corpo):
    cli = make_user()
    falso = gemini(monkeypatch, DOIS_ITENS)
    res = cli.post("/agent/parse", json={"date": hoje().isoformat(), **corpo})
    assert res.status_code == 422, res.text
    assert falso.chamadas == []


def test_quebra_de_linha_no_texto_e_aceita(monkeypatch, make_user, db_session):
    semear_catalogo(db_session)
    cli = make_user()
    gemini(monkeypatch, DOIS_ITENS)
    res = cli.post("/agent/parse", json={"text": "2 ovos\npão", "date": hoje().isoformat()})
    assert res.status_code == 200, res.text


def test_gemini_fora_503_sem_debitar(monkeypatch, make_user, db_session):
    cli = make_user()
    gemini(monkeypatch, None)
    res = cli.post("/agent/parse", json={"text": "2 ovos", "date": hoje().isoformat()})
    assert res.status_code == 503
    assert res.json()["detail"]["code"] == "AGENT_UNAVAILABLE"
    assert usos(db_session) == 0


def test_resposta_sem_json_debita_e_devolve_vazio(monkeypatch, make_user, db_session):
    cli = make_user()
    gemini(monkeypatch, "não sei")
    res = cli.post("/agent/parse", json={"text": "2 ovos", "date": hoje().isoformat()})
    assert res.status_code == 200
    assert res.json()["items"] == []
    assert usos(db_session) == 1


def test_sem_login_401(client):
    res = client.post("/agent/parse", json={"text": "2 ovos", "date": hoje().isoformat()})
    assert res.status_code == 401
