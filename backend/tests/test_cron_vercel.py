"""Rotas de cron da Vercel (GET /internal/cron/*): protegidas por CRON_SECRET."""

import pytest

from app.core.config import settings

SEGREDO = "segredo-de-teste"
ROTAS = ["/internal/cron/lifecycle", "/internal/cron/retention"]


@pytest.mark.parametrize("rota", ROTAS)
def test_cron_sem_segredo_responde_401(client, monkeypatch, rota):
    monkeypatch.setattr(settings, "CRON_SECRET", SEGREDO)
    assert client.get(rota).status_code == 401
    assert client.get(rota, headers={"Authorization": "Bearer errado"}).status_code == 401


@pytest.mark.parametrize("rota", ROTAS)
def test_cron_sem_segredo_configurado_responde_503(client, monkeypatch, rota):
    monkeypatch.setattr(settings, "CRON_SECRET", "")
    assert client.get(rota, headers={"Authorization": "Bearer "}).status_code == 503


@pytest.mark.parametrize("rota", ROTAS)
def test_cron_com_bearer_roda_o_job(client, monkeypatch, rota):
    monkeypatch.setattr(settings, "CRON_SECRET", SEGREDO)
    res = client.get(rota, headers={"Authorization": f"Bearer {SEGREDO}"})
    assert res.status_code == 200, res.text


def test_cron_aceita_cabecalho_x_cron_secret(client, monkeypatch):
    monkeypatch.setattr(settings, "CRON_SECRET", SEGREDO)
    res = client.get("/internal/cron/retention", headers={"X-Cron-Secret": SEGREDO})
    assert res.status_code == 200


def test_post_existente_aceita_bearer(client, monkeypatch):
    monkeypatch.setattr(settings, "CRON_SECRET", SEGREDO)
    res = client.post("/internal/retention/run", headers={"Authorization": f"Bearer {SEGREDO}"})
    assert res.status_code == 200


def test_scheduler_nao_inicia_na_vercel(monkeypatch):
    import sys
    from app.core import scheduler

    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.delitem(sys.modules, "pytest")  # o guard de teste vem antes
    try:
        scheduler.start_scheduler()
        assert scheduler._scheduler is None
    finally:
        sys.modules["pytest"] = pytest
