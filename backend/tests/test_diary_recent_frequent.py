"""Recentes e frequentes — Frente R, Tarefa 3."""

from datetime import timedelta

from app.models.diary import DiaryEntry
from tests.diary_helpers import AZEITE, ARROZ, OVO, criar, hoje, semear_catalogo, usuario

MINE = {"name": "Granola caseira", "kcal": 150}


def _refs(res):
    assert res.status_code == 200, res.text
    return [i["food"]["food_ref"] for i in res.json()["items"]]


def test_recentes_distintos_mais_recente_primeiro(make_user, db_session):
    semear_catalogo(db_session)
    cli = make_user()
    criar(cli, food_ref=ARROZ, data=hoje() - timedelta(days=3), quantity=100)
    criar(cli, food_ref=OVO, data=hoje() - timedelta(days=2), quantity=2, unit="un", slot="jantar")
    criar(cli, food_ref=ARROZ, data=hoje() - timedelta(days=1), quantity=150, slot="cafe_da_manha")
    res = cli.get("/diary/foods/recent")
    assert _refs(res) == [ARROZ, OVO]
    arroz = res.json()["items"][0]
    # quantidade, unidade e refeição da entrada mais recente do ref
    assert (arroz["quantity"], arroz["unit"], arroz["meal_slot"]) == (150, "g", "cafe_da_manha")
    assert arroz["count"] == 2
    assert arroz["food"]["name"]


def test_frequentes_janela_30_dias(make_user, db_session):
    semear_catalogo(db_session)
    cli = make_user()
    for d in (31, 40, 50):  # fora da janela: não contam
        criar(cli, food_ref=AZEITE, data=hoje() - timedelta(days=d), quantity=10, unit="ml")
    for d in (1, 2):
        criar(cli, food_ref=ARROZ, data=hoje() - timedelta(days=d))
    criar(cli, food_ref=OVO, data=hoje(), quantity=1, unit="un")
    res = cli.get("/diary/foods/frequent")
    assert _refs(res) == [ARROZ, OVO]
    assert res.json()["items"][0]["count"] == 2


def test_frequentes_empate_pelo_mais_recente(make_user, db_session):
    semear_catalogo(db_session)
    cli = make_user()
    criar(cli, food_ref=ARROZ, data=hoje() - timedelta(days=5))
    criar(cli, food_ref=OVO, data=hoje() - timedelta(days=1), quantity=1, unit="un")
    assert _refs(cli.get("/diary/foods/frequent")) == [OVO, ARROZ]


def test_recentes_ignora_ref_que_nao_resolve(make_user, db_session):
    semear_catalogo(db_session)
    cli = make_user()
    pessoal = cli.post("/diary/foods/mine", json=MINE).json()
    criar(cli, food_ref=ARROZ, data=hoje() - timedelta(days=2))
    r = criar(cli, food_ref=pessoal["food_ref"], quantity=1, unit="un")
    assert r.status_code == 201
    assert _refs(cli.get("/diary/foods/recent")) == [pessoal["food_ref"], ARROZ]
    # apaga o alimento pessoal: a entrada antiga segue intacta, mas não é mais oferecida
    cli.delete(f"/diary/foods/mine/{pessoal['id']}")
    assert _refs(cli.get("/diary/foods/recent")) == [ARROZ]
    assert _refs(cli.get("/diary/foods/frequent")) == [ARROZ]
    dia = cli.get("/diary", params={"date": hoje().isoformat()}).json()
    assert dia["totals"]["calories"] == 150


def test_recentes_isolados_por_usuario(make_user, db_session):
    semear_catalogo(db_session)
    a = make_user("a@example.com")
    b = make_user("b@example.com")
    criar(a, food_ref=ARROZ)
    assert _refs(b.get("/diary/foods/recent")) == []
    assert _refs(b.get("/diary/foods/frequent")) == []


def test_limit_fora_da_faixa_422(make_user):
    cli = make_user()
    for rota in ("recent", "frequent"):
        for limit in (0, 51):
            assert cli.get(f"/diary/foods/{rota}", params={"limit": limit}).status_code == 422
    assert cli.get("/diary/foods/recent", params={"limit": 50}).status_code == 200


def test_limit_respeitado(make_user, db_session):
    semear_catalogo(db_session)
    cli = make_user()
    criar(cli, food_ref=ARROZ)
    criar(cli, food_ref=OVO, quantity=1, unit="un")
    assert len(_refs(cli.get("/diary/foods/recent", params={"limit": 1}))) == 1
