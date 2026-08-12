"""Rede de segurança das migrations — o teste que faltou.

CONTEXTO (não apague: é o motivo de este arquivo existir)
=========================================================
A produção quebrou com `UndefinedTable: relation "diary_entries" does not exist` num
`GET /diary`, com a suíte 100% verde. O ponto cego é estrutural, não um descuido:

    tests/conftest.py:39   Base.metadata.create_all(bind=engine)

A suíte monta o schema A PARTIR DOS MODELOS. A produção monta a partir das MIGRATIONS.
São duas fontes de verdade e nada as comparava — a suíte passaria com o arquivo de
migration vazio, errado ou apagado.

Este módulo fecha exatamente esse buraco, rodando a cadeia REAL de migrations num banco
Postgres descartável e exigindo que o schema resultante seja idêntico a `Base.metadata`.

POR QUE POSTGRES-ONLY
--------------------
A cadeia não sobe em SQLite (migrations antigas usam `ALTER COLUMN ... DROP NOT NULL`,
sintaxe exclusiva do Postgres). Sem Postgres alcançável, os testes que precisam de banco
são pulados com instrução de como subir; o teste de head única não depende de banco e
roda em qualquer máquina.

POR QUE SUBPROCESSO PARA O ALEMBIC
----------------------------------
`migrations/env.py` lê a URL de `settings.DATABASE_URL`, e o `.env` do projeto aponta
para o Supabase de PRODUÇÃO. Rodar o alembic in-process exigiria remendar o objeto
`settings` global — um monkeypatch que vazasse deixaria uma migration correndo contra
produção. O subprocesso recebe `DATABASE_URL` do banco descartável por variável de
ambiente (que tem precedência sobre o `.env` no pydantic-settings) e não tem como
enxergar outra coisa. `_assert_url_e_descartavel` é o cinto sobre a suspensória.
"""

from __future__ import annotations

import os
import subprocess
import sys
import uuid
from pathlib import Path
from urllib.parse import quote_plus, urlsplit

import psycopg2
import pytest
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from psycopg2 import sql
from sqlalchemy import create_engine

from app.db.base import Base  # agregador: garante TODOS os models em Base.metadata

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_DIR.parent
ALEMBIC_INI = BACKEND_DIR / "alembic.ini"

# Variável que o CI exporta apontando para o serviço Postgres do runner. Localmente ela
# não existe e a URL é montada a partir dos POSTGRES_* do .env da raiz.
ENV_VAR_URL_ADMIN = "MIGRATION_TEST_DATABASE_URL"

COMO_SUBIR = (
    f"Postgres não alcançável. Estes testes rodam a cadeia real de migrations e são "
    f"Postgres-only (a cadeia não sobe em SQLite). Suba o banco com "
    f"`docker compose up -d db` na raiz do projeto, ou aponte {ENV_VAR_URL_ADMIN} para "
    f"um Postgres descartável."
)

# ---------------------------------------------------------------------------------
# DIVERGÊNCIAS CONHECIDAS — leia antes de mexer
# ---------------------------------------------------------------------------------
# Isto NÃO é uma válvula de escape para fazer o teste passar. É um pino exato do estado
# atual: a comparação é por IGUALDADE, não por "está contido". Uma divergência nova
# reprova o teste (não está aqui), e uma divergência daqui que seja CORRIGIDA também
# reprova (obriga a apagar a linha). O conjunto só pode encolher.
#
# Cada entrada é (operação, tabela, objeto) e precisa de justificativa e dono.
#
# ('remove_constraint', 'payments', 'payments_mp_payment_id_key')
#     ACHADO REAL, encontrado por este teste na sua primeira execução — não é ruído.
#     A migration 5edcb0977336 cria DUAS travas de unicidade na MESMA coluna
#     `payments.mp_payment_id`: a UniqueConstraint da linha `sa.UniqueConstraint(
#     'mp_payment_id')` (que o Postgres batiza de `payments_mp_payment_id_key`) e o
#     índice único `ix_payments_mp_payment_id`. O modelo `Payment` declara
#     `unique=True, index=True`, o que no SQLAlchemy gera UM único objeto — o índice
#     único — e nenhuma UniqueConstraint. Resultado: produção carrega um índice extra,
#     pago em toda escrita, e um nome de constraint que NÃO existe no ambiente montado
#     por create_all(). Qualquer `ON CONFLICT ON CONSTRAINT` ou tratamento de
#     IntegrityError por nome de constraint se comporta diferente nos dois lugares.
#     NÃO corrigido aqui de propósito: a correção é uma migration nova (DROP CONSTRAINT),
#     e o escopo desta tarefa proíbe alterar app/ e migrations. Reportado ao autor da
#     feature de pagamentos.
DIVERGENCIAS_CONHECIDAS: set[tuple[str, str, str]] = {
    ("remove_constraint", "payments", "payments_mp_payment_id_key"),
}


# ---------------------------------------------------------------------------------
# Descoberta do Postgres local
# ---------------------------------------------------------------------------------


def _ler_env_da_raiz() -> dict[str, str]:
    """Lê APENAS as chaves POSTGRES_* do .env da raiz.

    Whitelist proposital: `DATABASE_URL` mora no mesmo arquivo apontando para o Supabase
    de produção e não pode entrar aqui por acidente.
    """
    interessantes = {
        "POSTGRES_USER",
        "POSTGRES_PASSWORD",
        "POSTGRES_DB",
        "POSTGRES_HOST",
        "POSTGRES_PORT",
    }
    valores: dict[str, str] = {}
    arquivo = PROJECT_ROOT / ".env"
    if not arquivo.is_file():
        return valores

    for linha in arquivo.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        chave, _, valor = linha.partition("=")
        chave = chave.strip()
        if chave in interessantes:
            valores[chave] = valor.strip().strip("'\"")
    return valores


def _urls_admin_candidatas() -> list[str]:
    """URLs do banco de MANUTENÇÃO (`postgres`), usado só para CREATE/DROP DATABASE.

    Precedência: variável de ambiente do CI > POSTGRES_* (do ambiente ou do .env).

    Devolve LISTA porque `POSTGRES_HOST` no .env vale `db` — o nome do serviço na rede do
    docker-compose, que só resolve de dentro de um container. Rodando a suíte no host, o
    mesmo Postgres atende em `localhost` (a porta está publicada). Em vez de escolher um
    dos dois e quebrar no outro, tentamos os dois na ordem.
    """
    do_ambiente = os.environ.get(ENV_VAR_URL_ADMIN)
    if do_ambiente:
        return [do_ambiente]

    do_arquivo = _ler_env_da_raiz()

    def _cfg(chave: str, padrao: str) -> str:
        return os.environ.get(chave) or do_arquivo.get(chave) or padrao

    usuario = quote_plus(_cfg("POSTGRES_USER", "postgres"))
    senha = quote_plus(_cfg("POSTGRES_PASSWORD", "postgres"))
    porta = _cfg("POSTGRES_PORT", "5432")

    hosts: list[str] = []
    for host in (_cfg("POSTGRES_HOST", "localhost"), "localhost"):
        if host not in hosts:
            hosts.append(host)

    # Sempre o banco de manutenção: nunca o POSTGRES_DB da aplicação, para não haver
    # caminho em que o teste abra transação no schema de desenvolvimento.
    return [f"postgresql://{usuario}:{senha}@{host}:{porta}/postgres" for host in hosts]


def _conectar_admin(url: str):
    """Conexão em autocommit no banco de manutenção (CREATE/DROP DATABASE exige isso)."""
    conexao = psycopg2.connect(url, connect_timeout=3)
    conexao.autocommit = True
    return conexao


@pytest.fixture(scope="session")
def url_admin() -> str:
    """Primeira URL candidata que responde. Pula os testes de banco se nenhuma responde."""
    for url in _urls_admin_candidatas():
        try:
            _conectar_admin(url).close()
            return url
        except psycopg2.Error:
            continue
    pytest.skip(COMO_SUBIR)


@pytest.fixture
def banco_descartavel(url_admin: str) -> str:
    """Cria um banco vazio exclusivo deste teste e o derruba no fim.

    Nome único por teste: nenhum teste herda schema de outro, e a suíte continua correta
    se um dia rodar em paralelo. Jamais toca no banco de desenvolvimento (`nutri_db`).
    """
    nome = f"migracao_teste_{uuid.uuid4().hex[:12]}"
    conexao = _conectar_admin(url_admin)
    try:
        with conexao.cursor() as cursor:
            cursor.execute(sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(sql.Identifier(nome)))
            cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(nome)))
    finally:
        conexao.close()

    partes = urlsplit(url_admin)
    assert partes.path.lstrip("/") != nome  # sanidade: admin != descartável
    url_descartavel = partes._replace(path=f"/{nome}").geturl()

    try:
        yield url_descartavel
    finally:
        conexao = _conectar_admin(url_admin)
        try:
            with conexao.cursor() as cursor:
                cursor.execute(sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(sql.Identifier(nome)))
        finally:
            conexao.close()


# ---------------------------------------------------------------------------------
# Execução do alembic
# ---------------------------------------------------------------------------------


def _assert_url_e_descartavel(url: str) -> None:
    """Trava de segurança: só banco descartável pode receber migration de teste.

    Barra qualquer URL que não seja um `migracao_teste_*`. Se um dia alguém passar a URL
    de produção por engano (ou o override de ambiente falhar), o teste morre aqui em vez
    de rodar `upgrade`/`downgrade` no Supabase.
    """
    nome_do_banco = urlsplit(url).path.lstrip("/")
    assert nome_do_banco.startswith("migracao_teste_"), (
        f"Recusando rodar migration contra {nome_do_banco!r}: só bancos descartáveis "
        f"`migracao_teste_*` são aceitos."
    )


def _rodar_alembic(url: str, *argumentos: str) -> None:
    """Executa o alembic em subprocesso com DATABASE_URL forçado no banco descartável."""
    _assert_url_e_descartavel(url)

    ambiente = os.environ.copy()
    ambiente["DATABASE_URL"] = url  # precede o .env no pydantic-settings
    # Os dois abaixo são obrigatórios para `Settings()` instanciar; nenhum é usado pelas
    # migrations. Valores falsos de propósito.
    ambiente.setdefault("SECRET_KEY", "migration-test-not-a-real-secret")
    ambiente.setdefault("GEMINI_API_KEY", "migration-test-not-a-real-key")
    ambiente["ENVIRONMENT"] = "test"

    resultado = subprocess.run(
        [sys.executable, "-m", "alembic", "-c", str(ALEMBIC_INI), *argumentos],
        cwd=BACKEND_DIR,
        env=ambiente,
        capture_output=True,
        text=True,
        timeout=180,
    )
    if resultado.returncode != 0:
        pytest.fail(
            f"`alembic {' '.join(argumentos)}` falhou (exit {resultado.returncode}).\n"
            f"--- stdout ---\n{resultado.stdout}\n--- stderr ---\n{resultado.stderr}"
        )


def _diretorio_de_scripts() -> ScriptDirectory:
    """Lê o histórico de revisões do disco. Não abre conexão nem executa env.py."""
    return ScriptDirectory.from_config(Config(str(ALEMBIC_INI)))


# ---------------------------------------------------------------------------------
# Formatação das divergências
# ---------------------------------------------------------------------------------


def _descrever(diferenca) -> str:
    """Traduz uma tupla do compare_metadata em uma linha que diz QUAL objeto divergiu."""
    if isinstance(diferenca, list):  # modify_* vêm agrupados numa lista
        return "; ".join(_descrever(item) for item in diferenca)

    operacao = diferenca[0]

    if operacao in ("add_table", "remove_table"):
        tabela = diferenca[1]
        lado = "só nos MODELOS (migration não cria)" if operacao == "add_table" else "só nas MIGRATIONS (modelo não declara)"
        return f"{operacao}: tabela {tabela.name!r} — {lado}"

    if operacao in ("add_column", "remove_column"):
        _, _esquema, tabela, coluna = diferenca
        lado = "só nos MODELOS" if operacao == "add_column" else "só nas MIGRATIONS"
        return f"{operacao}: {tabela}.{coluna.name} ({coluna.type}) — {lado}"

    if operacao in ("add_index", "remove_index", "add_constraint", "remove_constraint"):
        objeto = diferenca[1]
        tabela = getattr(getattr(objeto, "table", None), "name", "?")
        lado = "só nos MODELOS" if operacao.startswith("add_") else "só nas MIGRATIONS"
        return f"{operacao}: {objeto.name!r} em {tabela} — {lado}"

    if operacao.startswith("modify_"):
        _, _esquema, tabela, coluna, _opcoes, valor_no_banco, valor_no_modelo = diferenca
        atributo = operacao.removeprefix("modify_")
        return (
            f"{operacao}: {tabela}.{coluna} — {atributo} é {valor_no_banco!r} nas "
            f"MIGRATIONS e {valor_no_modelo!r} nos MODELOS"
        )

    return f"{operacao}: {diferenca[1:]!r}"


def _chave(diferenca) -> tuple[str, str, str]:
    """Identidade estável de uma divergência: (operação, tabela, objeto)."""
    operacao = diferenca[0]

    if operacao in ("add_table", "remove_table"):
        return (operacao, diferenca[1].name, "*")

    if operacao in ("add_column", "remove_column"):
        return (operacao, diferenca[2], diferenca[3].name)

    if operacao in ("add_index", "remove_index", "add_constraint", "remove_constraint"):
        objeto = diferenca[1]
        return (operacao, getattr(getattr(objeto, "table", None), "name", "?"), str(objeto.name))

    if operacao.startswith("modify_"):
        return (operacao, diferenca[2], diferenca[3])

    return (operacao, "?", repr(diferenca[1:]))


def _achatar(diferencas: list) -> list:
    """compare_metadata agrupa os `modify_*` de uma mesma coluna numa sublista."""
    plano = []
    for diferenca in diferencas:
        plano.extend(diferenca if isinstance(diferenca, list) else [diferenca])
    return plano


def _relatorio(diferencas: list, chaves: set) -> str:
    linhas = "\n".join(f"  - {_descrever(d)}" for d in diferencas if _chave(d) in chaves)
    return (
        f"O schema produzido por `alembic upgrade head` NÃO bate com Base.metadata "
        f"({len(chaves)} divergência(s) não documentada(s)).\n"
        f"Cada linha é uma diferença que a suíte com create_all() não enxerga e que a "
        f"produção sente:\n{linhas}\n"
        f"Conserte a MIGRATION (ou o modelo) — não este teste."
    )


def _comparar_com_os_modelos(conexao) -> tuple[list, set, set]:
    """Compara o banco migrado com Base.metadata e classifica o resultado.

    Devolve (diferenças, não documentadas, documentadas que sumiram).
    """
    contexto = MigrationContext.configure(conexao)
    # Sanidade: se o override de DATABASE_URL tivesse falhado, o alembic teria migrado
    # outro banco e este aqui estaria vazio.
    assert contexto.get_current_revision() is not None, (
        "O banco descartável não tem revisão aplicada — o `upgrade head` foi para outro "
        "lugar. NÃO prossiga sem investigar qual URL o alembic usou."
    )

    diferencas = _achatar(compare_metadata(contexto, Base.metadata))
    observadas = {_chave(d) for d in diferencas}
    return diferencas, observadas - DIVERGENCIAS_CONHECIDAS, DIVERGENCIAS_CONHECIDAS - observadas


def _exigir_fidelidade(diferencas: list, nao_documentadas: set, sumiram: set) -> None:
    assert not nao_documentadas, _relatorio(diferencas, nao_documentadas)
    assert not sumiram, (
        f"Divergência conhecida não existe mais: {sorted(sumiram)}.\n"
        f"Ótima notícia — foi corrigida. Apague a entrada correspondente de "
        f"DIVERGENCIAS_CONHECIDAS em {Path(__file__).name} para o teste voltar a exigir "
        f"fidelidade total nesse objeto."
    )


# ---------------------------------------------------------------------------------
# Testes
# ---------------------------------------------------------------------------------


def test_alembic_tem_uma_unica_head():
    """Duas heads = duas branches criaram migration em paralelo. Quebra o deploy.

    Não precisa de banco: roda em qualquer máquina, com ou sem Docker.
    """
    heads = _diretorio_de_scripts().get_heads()
    assert len(heads) == 1, (
        f"O Alembic tem {len(heads)} heads: {heads}. Um `upgrade head` com múltiplas "
        f"heads falha no deploy. Una as branches com `alembic merge`."
    )


def test_migrations_produzem_o_mesmo_schema_dos_modelos(banco_descartavel: str):
    """O teste que teria pego a quebra de ontem.

    Roda a cadeia real de migrations num banco limpo e compara o resultado com
    `Base.metadata` via `alembic.autogenerate.compare_metadata` — a mesma engine que o
    `--autogenerate` usa. Tabela, coluna, nullability, tipo ou índice fora do lugar
    reprovam, nomeando o objeto.
    """
    _rodar_alembic(banco_descartavel, "upgrade", "head")

    engine = create_engine(banco_descartavel)
    try:
        with engine.connect() as conexao:
            resultado = _comparar_com_os_modelos(conexao)
    finally:
        engine.dispose()

    _exigir_fidelidade(*resultado)


def test_ultima_migration_desce_e_sobe_de_novo(banco_descartavel: str):
    """Migration que não desce é armadilha: sem downgrade não há rollback em produção.

    upgrade head -> downgrade -1 -> upgrade head, tudo no banco descartável.
    """
    _rodar_alembic(banco_descartavel, "upgrade", "head")

    scripts = _diretorio_de_scripts()
    (head,) = scripts.get_heads()

    _rodar_alembic(banco_descartavel, "downgrade", "-1")

    engine = create_engine(banco_descartavel)
    try:
        with engine.connect() as conexao:
            revisao_apos_descer = MigrationContext.configure(conexao).get_current_revision()
    finally:
        engine.dispose()

    assert revisao_apos_descer != head, (
        f"Depois do `downgrade -1` o banco continua em {head!r}: o downgrade não teve efeito."
    )

    _rodar_alembic(banco_descartavel, "upgrade", "head")

    engine = create_engine(banco_descartavel)
    try:
        with engine.connect() as conexao:
            revisao_final = MigrationContext.configure(conexao).get_current_revision()
            diferencas, nao_documentadas, sumiram = _comparar_com_os_modelos(conexao)
    finally:
        engine.dispose()

    assert revisao_final == head
    assert not nao_documentadas, (
        "A ida e volta deixou o schema diferente do que o `upgrade head` direto produz — "
        "o downgrade não é o inverso exato do upgrade.\n"
        + _relatorio(diferencas, nao_documentadas)
    )
    assert not sumiram, (
        f"Depois de descer e subir, estas divergências conhecidas sumiram: "
        f"{sorted(sumiram)}. Isso significa que o downgrade+upgrade NÃO reproduz o mesmo "
        f"schema do upgrade direto — dois caminhos, dois bancos diferentes."
    )
