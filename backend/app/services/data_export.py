"""Exportação dos dados do titular (LGPD Art. 18, II e V).

Percorre o schema em vez de listar tabela por tabela: todo `user_id` é exportado, e
tabelas-filhas (itens de refeição, dias de cardápio, ingredientes...) entram pela FK
para uma tabela já exportada. Tabela nova com `user_id` entra sozinha.
"""
from datetime import datetime, timezone

from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.legal import POLICY_VERSION
from app.db.base import Base
from app.models.user import User

# Fora da exportação: credenciais do aparelho (push) e caches compartilhados.
EXCLUIDAS = {"users", "push_subscriptions", "food_cache", "food_catalog"}
# Campos que nunca saem.
CAMPOS_SECRETOS = {"hashed_password"}


def _linhas(db: Session, tabela, condicao):
    return [
        {k: v for k, v in r._mapping.items() if k not in CAMPOS_SECRETOS}
        for r in db.execute(select(tabela).where(condicao)).all()
    ]


def export_user_data(db: Session, user: User) -> dict:
    dados: dict[str, list[dict]] = {}
    ids: dict[str, set] = {}
    pendentes = [t for t in Base.metadata.sorted_tables if t.name not in EXCLUIDAS]

    for t in pendentes:
        if "user_id" in t.c:
            linhas = _linhas(db, t, t.c.user_id == user.id)
            dados[t.name] = linhas
            ids[t.name] = {l["id"] for l in linhas if "id" in l}

    mudou = True
    while mudou:
        mudou = False
        for t in pendentes:
            if t.name in dados:
                continue
            for fk in t.foreign_keys:
                pai = fk.column.table.name
                if pai in dados and pai != "users":
                    linhas = _linhas(db, t, t.c[fk.parent.name].in_(ids[pai] or {-1}))
                    dados[t.name] = linhas
                    ids[t.name] = {l["id"] for l in linhas if "id" in l}
                    mudou = True
                    break

    return jsonable_encoder({
        "exported_at": datetime.now(timezone.utc),
        "policy_version": POLICY_VERSION,
        "user": {
            "id": user.id, "email": user.email, "full_name": user.full_name,
            "is_verified": user.is_verified, "created_at": user.created_at,
            "last_login_at": user.last_login_at, "score": user.score,
        },
        "data": dict(sorted(dados.items())),
    })
