"""Testes de auditoria do diário alimentar — cada um prova um achado do relatório.

Relatório: `docs/qa/relatorio-diario.md`.

Estes testes descrevem o comportamento CORRETO segundo o ADR-0001. Os que falham hoje
são a prova do defeito; os que passam estão marcados como documentação do estado atual.
Nenhum código de aplicação foi alterado para fazê-los passar.
"""

from datetime import date, datetime, timedelta

import pytest
from sqlalchemy import event

from app.models.food_cache import FoodCache
from tests.conftest import engine
from tests.diary_helpers import (
    ARROZ,
    OVO,
    cardapio,
    criar,
    hoje,
    perfil,
    semear_catalogo,
    usuario,
)


# ======================================================================================
# A-01 — o formulário de porção abre com quantidade 100 mesmo para alimento de unidade
# ======================================================================================


def test_achado_a01_unidade_de_contagem_com_quantidade_de_gramas(
    client, db_session, make_user
):
    """DOCUMENTA o estado atual (passa hoje). O defeito é do frontend, não daqui.

    O servidor está certo: 70 kcal/un × 100 un = 7000 kcal é a conta correta para o que
    foi pedido. O problema é a interface pedir 100 por padrão para um alimento cuja
    unidade base é `un` — ver `frontend/src/pages/DiaryLog.tsx:477` e o teste
    `frontend/src/pages/achado_DiaryLog.porcao.test.tsx`, que falha.

    Este teste existe para fixar o número: se algum dia o backend passar a recusar
    quantidades absurdas em unidade de contagem, ele quebra e o relatório é revisitado.
    """
    cli = make_user()
    semear_catalogo(db_session)

    res = criar(cli, food_ref=OVO, quantity=100, unit="un")

    assert res.status_code == 201, res.text
    assert res.json()["totals"]["calories"] == 7000.0
    # Nem o teto de plausibilidade do RS-10 (20.000 kcal) nem o `le=10_000` de quantity
    # veem problema: 100 ovos passam pelas duas redes.


# ======================================================================================
# A-03 — cache com unit_type fora do domínio derruba o POST /diary com 500
# ======================================================================================


# ---------------------------------------------------------------------------------
# `xfail(strict=True)` NAO e' tolerancia ao defeito — e' o registro dele.
#
# O teste PASSA enquanto o defeito existir e fica VERMELHO no dia em que alguem o
# corrigir, obrigando a apagar o marcador. `skip` esconderia; deixar falhando treinaria
# o time a ignorar vermelho no CI. Cada `reason` abaixo aponta o achado no relatorio
# `docs/qa/relatorio-diario.md`.
# ---------------------------------------------------------------------------------


@pytest.mark.xfail(strict=True, reason=(
    "A-03 (Media): POST /diary devolve 500 quando o food_ref aponta para linha de food_cache com unit_type fora de g|ml|un. Linhas assim sao criadas por /ai/calculate-calories, que aceita unit como texto livre."
))
def test_achado_a03_cache_com_unit_type_invalido_nao_pode_dar_500(
    client, db_session, make_user
):
    """FALHA HOJE (500 em vez de 404).

    A linha abaixo é EXATAMENTE a que `POST /ai/calculate-calories` grava: aquele endpoint
    aceita `unit` como texto livre (`app/routers/ai.py:51`, `str` de 1 a 40 caracteres) e
    o repassa direto para `food_cache.unit_type` (`app/services/ai.py:219-224`). Com
    `source="taco"` e `created_by_user_id=NULL` a linha é COMPARTILHADA: qualquer usuário
    a alcança pelo escopo de `_resolver_food_ref`.

    `opcao_do_cache` monta `FoodOption(base_unit=linha.unit_type)` sem checar o domínio, e
    `FoodBaseUnitType` é `Literal["g","ml","un"]` — o Pydantic estoura dentro do router e
    ninguém captura.

    O correto é tratar a linha como não resolvida: 404 FOOD_NOT_RESOLVED, o mesmo corpo do
    id inexistente. Um valor que não dá para servir não é erro de servidor.
    """
    cli = make_user()
    u = usuario(db_session, "user@example.com")

    linha = FoodCache(
        name="rap10",
        name_normalized="rap10",
        calories_per_unit=120.0,
        unit_type="unidade",  # <- texto livre vindo de /ai/calculate-calories
        source="taco",
        created_by_user_id=None,
    )
    db_session.add(linha)
    db_session.commit()
    db_session.refresh(linha)

    res = criar(cli, food_ref=f"cache:{linha.id}", quantity=1, unit="un")

    assert res.status_code != 500, f"500 não tratado: {res.text}"
    assert res.status_code == 404
    assert res.json()["detail"]["code"] == "FOOD_NOT_RESOLVED"


# ======================================================================================
# A-04 — GET /diary/summary emite uma query de binding por dia
# ======================================================================================


class _ContadorDeQueries:
    """Conta statements emitidos no engine da suíte durante um bloco."""

    def __init__(self) -> None:
        self.statements: list[str] = []

    def __enter__(self):
        event.listen(engine, "before_cursor_execute", self._registrar)
        return self

    def __exit__(self, *_):
        event.remove(engine, "before_cursor_execute", self._registrar)
        return False

    def _registrar(self, conn, cursor, statement, parameters, context, executemany):
        self.statements.append(" ".join(statement.split()))

    def contendo(self, trecho: str) -> int:
        return sum(1 for s in self.statements if trecho in s)


@pytest.mark.xfail(strict=True, reason=(
    "A-04 (Media): GET /diary/summary resolve o vinculo com uma query por dia (ate 32), contrariando a propria docstring."
))
def test_achado_a04_summary_nao_pode_ter_uma_query_de_binding_por_dia(
    client, db_session, make_user
):
    """FALHA HOJE (32 SELECTs em diary_plan_bindings para um intervalo de 32 dias).

    A docstring da própria rota (`app/routers/diary.py:264-268`) afirma "nunca uma query
    por dia". `resolver_dia_do_plano` (`app/services/diary_plan.py:64-77`) emite um SELECT
    novo a cada chamada, e o laço de `ler_faixa` (`app/routers/diary.py:309-315`) a chama
    uma vez por dia do intervalo.

    Importa porque o § 11 do ADR-0001 dimensiona a feature inteira pelo pool de 5+5
    conexões por processo, disputado com o APScheduler.
    """
    cli = make_user()
    u = usuario(db_session, "user@example.com")
    perfil(db_session, u.id)
    plano = cardapio(
        db_session,
        u.id,
        dias=[[("Almoço", 600.0), ("Jantar", 500.0)], [("Café", 300.0)]],
    )
    cli.post(
        "/diary/plan-bindings",
        json={
            "meal_plan_id": plano.id,
            "start_date": (hoje() - timedelta(days=40)).isoformat(),
            "end_date": None,
        },
    )

    with _ContadorDeQueries() as contador:
        res = cli.get(
            "/diary/summary",
            params={
                "start": (hoje() - timedelta(days=31)).isoformat(),
                "end": hoje().isoformat(),
            },
        )

    assert res.status_code == 200, res.text
    assert len(res.json()["days"]) == 32

    consultas_de_binding = contador.contendo("FROM diary_plan_bindings")
    assert consultas_de_binding <= 2, (
        f"{consultas_de_binding} SELECTs em diary_plan_bindings para 32 dias — "
        "a resolução do vínculo está dentro do laço"
    )


# ======================================================================================
# A-05 — resolve acima do teto de escrita de cache devolve um alimento irregistrável
# ======================================================================================


@pytest.mark.xfail(strict=True, reason=(
    "A-05 (Media): alimento estimado acima do teto de escrita do cache consome cota paga e termina em 404 — beco sem saida."
))
def test_achado_a05_alimento_estimado_acima_do_teto_de_cache_nao_registra(
    client, db_session, make_user, monkeypatch
):
    """FALHA HOJE (o POST /diary devolve 404 para um alimento que o resolve entregou).

    Conta `pro`: a cota do plano é 200 resolves/dia (`app/core/plan_limits.py:58`), mas o
    teto de ESCRITA de cache é 50/dia (`app/services/diary_foods.py:44`). Entre o 51º e o
    200º resolve, `_opcao_efemera` devolve `food_ref="cache:0"` — que `_resolver_food_ref`
    recusa. A cota é debitada mesmo assim (`app/routers/diary_foods.py:123`).

    Para o usuário: paga, vê o alimento com calorias e badge "Estimativa", preenche a
    porção, e recebe "Não encontramos esse alimento. Tente outro nome."
    """
    cli = make_user(plan="pro")
    u = usuario(db_session, "user@example.com")

    # 50 linhas de cache do próprio usuário, criadas hoje: o teto de escrita já está cheio.
    for i in range(50):
        db_session.add(
            FoodCache(
                name=f"alimento {i}",
                name_normalized=f"alimento {i}",
                calories_per_unit=1.0,
                unit_type="g",
                source="llm",
                created_by_user_id=u.id,
                created_at=datetime.utcnow(),
            )
        )
    db_session.commit()

    # Fonte externa: OFF não acha, o modelo responde um valor plausível.
    monkeypatch.setattr(
        "app.services.diary_foods.consultar_open_food_facts", lambda nome, base: None
    )
    monkeypatch.setattr(
        "app.services.diary_foods.call_gemini", lambda *a, **k: "1.2"
    )

    res_resolve = cli.post(
        "/diary/foods/resolve", json={"name": "pao sirio integral", "unit": "g"}
    )
    assert res_resolve.status_code == 200, res_resolve.text
    opcao = res_resolve.json()
    assert opcao["kcal_per_base_unit"] == 1.2
    assert opcao["is_estimate"] is True

    # O contrato do § 6.2 diz que o resolve devolve "um alimento pronto para virar
    # entrada". Registrar o que ele acabou de entregar tem que funcionar.
    res_criar = criar(cli, food_ref=opcao["food_ref"], quantity=100, unit="g")
    assert res_criar.status_code == 201, (
        f"resolve entregou food_ref={opcao['food_ref']!r} e o POST /diary o recusou: "
        f"{res_criar.status_code} {res_criar.text}"
    )


# ======================================================================================
# A-06 — quantidade que arredonda para zero vira entrada de 0.0 kcal
# ======================================================================================


@pytest.mark.xfail(strict=True, reason=(
    "A-06 (Baixa): quantidade minuscula grava entrada afirmando 0.0 kcal em vez de recusar."
))
def test_achado_a06_quantidade_que_arredonda_para_zero_nao_deve_virar_entrada(
    client, db_session, make_user
):
    """FALHA HOJE (201 com calories_total = 0.0).

    1.28 kcal/g × 0.01 g = 0.0128 → `round(..., 1)` = 0.0. A linha é persistida, aparece
    como "0 kcal" e ocupa uma das 60 vagas do teto do RS-11.

    O § 9.4 do ADR-0001 é explícito: `0` é uma afirmação nutricional que ninguém fez. O
    `gt=0` de `quantity` existe pelo mesmo motivo ("0 g de um alimento não é registro, é
    ruído que polui o total e o gráfico") — e uma quantidade que arredonda para zero
    produz exatamente o ruído que ele queria evitar.
    """
    cli = make_user()
    semear_catalogo(db_session)

    res = criar(cli, food_ref=ARROZ, quantity=0.01, unit="g")

    if res.status_code == 201:
        entradas = [e for s in res.json()["slots"] for e in s["entries"]]
        registradas = [e["calories_total"] for e in entradas]
        assert 0.0 not in registradas, (
            "entrada persistida com calories_total = 0.0 — o dia passa a ter uma linha "
            f"que afirma zero caloria: {registradas}"
        )
    else:
        assert res.status_code == 422


# ======================================================================================
# A-07 — PATCH com campo explicitamente null passa pelo "ao menos um campo"
# ======================================================================================


@pytest.mark.xfail(strict=True, reason=(
    "A-07 (Baixa): PATCH com todos os campos nulos devolve 200 e a tela anuncia "
    "registro atualizado sem nada ter mudado."
))
def test_achado_a07_patch_com_campo_nulo_deve_ser_422(client, db_session, make_user):
    """FALHA HOJE (200 sem efeito).

    `pelo_menos_um_campo` (`app/schemas/diary.py:185-189`) testa `model_fields_set`, que
    contém `"quantity"` mesmo quando o valor enviado foi `null`. O router então cai no
    `payload.quantity if payload.quantity is not None else entrada.quantity` e não muda
    nada — mas devolve 200, e a interface anuncia "Registro atualizado."

    O corpo `{}` já devolve 422 pelo mesmo requisito. `{"quantity": null}` pede a mesma
    coisa (nenhuma mudança) e deveria receber a mesma resposta.
    """
    cli = make_user()
    semear_catalogo(db_session)
    dia = criar(cli, food_ref=ARROZ, quantity=100, unit="g").json()
    entry_id = [e["id"] for s in dia["slots"] for e in s["entries"]][0]

    assert cli.patch(f"/diary/{entry_id}", json={}).status_code == 422

    res = cli.patch(f"/diary/{entry_id}", json={"quantity": None})
    assert res.status_code == 422, (
        f"PATCH sem mudança nenhuma devolveu {res.status_code}; a tela mostra "
        '"Registro atualizado." para uma operação que não atualizou nada'
    )
