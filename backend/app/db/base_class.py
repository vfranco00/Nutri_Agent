"""Classe declarativa base — e SÓ ela.

Mora separada de `app/db/base.py` de propósito: `base.py` precisa importar todos os
models pra montar o `Base.metadata` completo, e os models precisam importar o `Base`.
Se as duas coisas vivessem no mesmo módulo, teríamos um ciclo de import
(`app.db.base` -> `app.models.user` -> `app.db.base`) que só funciona por acidente da
ordem de execução. Com o `Base` isolado aqui, o grafo é uma árvore:

    app.db.base  ->  app.models.*  ->  app.db.base_class

Model novo importa daqui. Quem precisa do metadata COMPLETO (Alembic, testes)
importa de `app.db.base`.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
