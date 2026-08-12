"""Regressão: erro de servidor não pode chegar ao navegador disfarçado de erro de CORS.

Exceção não tratada sobe até o `ServerErrorMiddleware` do Starlette, que é o middleware
mais externo de todos — por FORA do `CORSMiddleware`. O 500 saía sem
`Access-Control-Allow-Origin`, e o navegador reportava "blocked by CORS policy" em vez do
erro real. Quem depura vai investigar CORS, que está correto, e não o que quebrou.

Aconteceu de verdade: uma tabela ausente em produção apareceu no console do Chrome como
problema de CORS, e custou um diagnóstico inteiro.

O conserto é um middleware registrado ANTES do CORS (portanto mais interno) que captura a
exceção e devolve um 500 comum — resposta que ainda atravessa o CORS na volta.
"""

import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient

from app.main import app

ORIGEM = "https://nutri-agent-topaz.vercel.app"  # está em settings.cors_origin_list


@pytest.fixture(scope="module", autouse=True)
def rota_que_explode():
    """Rota registrada só para este módulo. Não dá para provar o comportamento sem uma
    exceção real: simular com mock testaria o mock, não a pilha de middlewares."""
    router = APIRouter()

    @router.get("/_teste_erro_interno")
    def _explode():
        raise RuntimeError("falha proposital do teste")

    app.include_router(router)
    yield
    app.router.routes = [
        r for r in app.router.routes if getattr(r, "path", None) != "/_teste_erro_interno"
    ]


@pytest.fixture
def cliente():
    # `raise_server_exceptions=False` para observar a RESPOSTA em vez de a exceção
    # explodir dentro do teste — é a resposta que o navegador recebe que está sob teste.
    return TestClient(app, raise_server_exceptions=False)


def test_erro_interno_devolve_500_e_nao_derruba_a_conexao(cliente):
    r = cliente.get("/_teste_erro_interno", headers={"Origin": ORIGEM})
    assert r.status_code == 500


def test_erro_interno_carrega_o_cabecalho_de_cors(cliente):
    """O ponto inteiro deste arquivo. Sem o cabeçalho, o navegador esconde o 500."""
    r = cliente.get("/_teste_erro_interno", headers={"Origin": ORIGEM})
    assert r.headers.get("access-control-allow-origin") == ORIGEM


def test_erro_interno_nao_vaza_detalhe_da_excecao(cliente):
    """Mensagem de erro é canal de vazamento: num diário alimentar o texto da exceção
    pode carregar nome de alimento, que é dado de saúde. O traceback fica no log."""
    r = cliente.get("/_teste_erro_interno", headers={"Origin": ORIGEM})
    corpo = r.text
    assert "falha proposital do teste" not in corpo
    assert "RuntimeError" not in corpo
    assert "Traceback" not in corpo
    assert r.json() == {"detail": "Erro interno."}


def test_o_traceback_vai_para_o_log_do_servidor(cliente, caplog):
    """Não vazar para o cliente não pode virar perder a informação."""
    with caplog.at_level("ERROR"):
        cliente.get("/_teste_erro_interno", headers={"Origin": ORIGEM})
    assert any("falha proposital do teste" in r.getMessage() or r.exc_info
               for r in caplog.records)


def test_origem_nao_autorizada_continua_sem_cabecalho(cliente):
    """O conserto não pode ter virado um `allow_origin: *` acidental — isso trocaria um
    erro confuso por uma falha de segurança."""
    r = cliente.get("/_teste_erro_interno", headers={"Origin": "https://invasor.example"})
    assert r.status_code == 500
    assert "access-control-allow-origin" not in {k.lower() for k in r.headers}


def test_resposta_de_erro_mantem_os_headers_de_seguranca(cliente):
    """`security_headers` fica por fora de tudo; a resposta do handler novo tem que
    continuar passando por ele na volta."""
    r = cliente.get("/_teste_erro_interno", headers={"Origin": ORIGEM})
    assert r.headers.get("X-Content-Type-Options") == "nosniff"
    assert r.headers.get("X-Frame-Options") == "DENY"
