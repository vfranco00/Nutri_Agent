"""L1.2 em Postgres de verdade: a suíte comum roda em SQLite, que não aplica FK.
Sobe a cadeia real de migrations e apaga uma conta com pagamento, evento e chamado."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.feedback import FeedbackTicket
from app.models.payment import Payment
from app.models.user import User
from app.services.account_erasure import erase_account
from tests.lgpd_helpers import semear
from tests.test_migrations import _rodar_alembic, banco_descartavel, url_admin  # noqa: F401


def test_exclusao_em_postgres_com_fk_reais(banco_descartavel, monkeypatch):  # noqa: F811
    monkeypatch.setattr("app.services.account_erasure.cancel_preapproval", lambda _id: True)
    _rodar_alembic(banco_descartavel, "upgrade", "head")
    engine = create_engine(banco_descartavel)
    db = sessionmaker(bind=engine)()
    try:
        u = User(email="pg@example.com", hashed_password="x", full_name="Pg")
        db.add(u)
        db.commit()
        semear(db, u)
        uid = u.id
        erase_account(db, u)
        assert db.query(User).filter(User.id == uid).count() == 0
        pg = db.query(Payment).one()
        assert pg.user_id is None
        assert db.query(FeedbackTicket).count() == 0
    finally:
        db.close()
        engine.dispose()
