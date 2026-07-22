from datetime import datetime, timedelta

from app.models.subscription import Subscription
from app.models.user import User
from app.services.subscription_lifecycle import (
    send_expiry_warnings,
    downgrade_expired_subscriptions,
)


def _make_subscribed_user(db_session, client, email, plan, current_period_end, expiry_warned_at=None):
    res = client.post("/users/", json={"email": email, "password": "strongpassword123", "full_name": "T"})
    assert res.status_code == 200, res.text
    user = db_session.query(User).filter(User.email == email).first()
    user.is_verified = True
    db_session.add(
        Subscription(
            user_id=user.id,
            plan=plan,
            status="active",
            current_period_end=current_period_end,
            expiry_warned_at=expiry_warned_at,
        )
    )
    db_session.commit()
    return user


def test_send_expiry_warnings_marks_subscriptions_within_7_days(client, db_session, monkeypatch):
    sent_to = []
    monkeypatch.setattr(
        "app.services.subscription_lifecycle.send_subscription_expiring_email",
        lambda to_email, plan_label, expires_at: sent_to.append(to_email) or True,
    )

    _make_subscribed_user(
        db_session, client, "vence_em_3_dias@example.com", "plus",
        datetime.utcnow() + timedelta(days=3),
    )

    count = send_expiry_warnings(db_session)
    assert count == 1
    assert sent_to == ["vence_em_3_dias@example.com"]

    sub = db_session.query(Subscription).join(User).filter(User.email == "vence_em_3_dias@example.com").first()
    assert sub.expiry_warned_at is not None


def test_send_expiry_warnings_skips_already_warned(client, db_session, monkeypatch):
    sent_to = []
    monkeypatch.setattr(
        "app.services.subscription_lifecycle.send_subscription_expiring_email",
        lambda to_email, plan_label, expires_at: sent_to.append(to_email) or True,
    )

    _make_subscribed_user(
        db_session, client, "ja_avisado@example.com", "plus",
        datetime.utcnow() + timedelta(days=2),
        expiry_warned_at=datetime.utcnow(),
    )

    count = send_expiry_warnings(db_session)
    assert count == 0
    assert sent_to == []


def test_send_expiry_warnings_ignores_subscriptions_outside_window(client, db_session, monkeypatch):
    sent_to = []
    monkeypatch.setattr(
        "app.services.subscription_lifecycle.send_subscription_expiring_email",
        lambda to_email, plan_label, expires_at: sent_to.append(to_email) or True,
    )

    _make_subscribed_user(
        db_session, client, "vence_em_20_dias@example.com", "plus",
        datetime.utcnow() + timedelta(days=20),
    )

    count = send_expiry_warnings(db_session)
    assert count == 0
    assert sent_to == []


def test_downgrade_expired_subscriptions_resets_to_starter(client, db_session):
    _make_subscribed_user(
        db_session, client, "venceu_ontem@example.com", "pro",
        datetime.utcnow() - timedelta(days=1),
    )

    count = downgrade_expired_subscriptions(db_session)
    assert count == 1

    sub = db_session.query(Subscription).join(User).filter(User.email == "venceu_ontem@example.com").first()
    assert sub.plan == "starter"
    assert sub.status == "canceled"
    assert sub.current_period_end is None


def test_downgrade_expired_subscriptions_leaves_active_ones_alone(client, db_session):
    _make_subscribed_user(
        db_session, client, "ainda_ativo@example.com", "plus",
        datetime.utcnow() + timedelta(days=5),
    )

    count = downgrade_expired_subscriptions(db_session)
    assert count == 0

    sub = db_session.query(Subscription).join(User).filter(User.email == "ainda_ativo@example.com").first()
    assert sub.plan == "plus"
