def test_metrics_requires_superuser(make_user):
    regular_client = make_user(email="naoadmin_metrics@example.com")
    res = regular_client.get("/admin/metrics")
    assert res.status_code == 403


def test_metrics_requires_authentication(client):
    res = client.get("/admin/metrics")
    assert res.status_code == 401


def test_metrics_reflects_known_data(make_user):
    admin_client = make_user(email="admin_metrics@example.com", superuser=True)
    make_user(email="plus_metrics@example.com", plan="plus")
    make_user(email="pro_metrics@example.com", plan="pro")
    make_user(email="starter_metrics@example.com", plan="starter")

    res = admin_client.get("/admin/metrics")
    assert res.status_code == 200
    data = res.json()

    # 4 usuários no total: o admin (starter por padrão) + os 3 criados acima.
    assert data["users_total"] == 4
    assert data["users_by_plan"]["plus"] == 1
    assert data["users_by_plan"]["pro"] == 1
    assert data["users_by_plan"]["starter"] == 2
    assert data["is_estimate"] is True
    # MRR = 1 plus (29.9) + 1 pro (59.9)
    assert data["mrr_estimate_brl"] == 89.8


def test_metrics_normalizes_meal_swap_event_types(make_user, db_session):
    from app.models.subscription import UsageEvent
    from app.models.user import User

    admin_client = make_user(email="admin_swap_metrics@example.com", superuser=True)
    user = db_session.query(User).filter(User.email == "admin_swap_metrics@example.com").first()

    db_session.add(UsageEvent(user_id=user.id, event_type="meal_swap:token-a"))
    db_session.add(UsageEvent(user_id=user.id, event_type="meal_swap:token-b"))
    db_session.add(UsageEvent(user_id=user.id, event_type="chef_ai"))
    db_session.commit()

    res = admin_client.get("/admin/metrics")
    usage = {u["event_type"]: u["count"] for u in res.json()["usage_last_30_days"]}
    assert usage["meal_swap"] == 2
    assert usage["chef_ai"] == 1


def test_activity_requires_superuser(make_user):
    regular_client = make_user(email="naoadmin_activity@example.com")
    res = regular_client.get("/admin/activity")
    assert res.status_code == 403


def test_activity_lists_recent_events(make_user, db_session):
    from app.models.subscription import UsageEvent
    from app.models.user import User

    admin_client = make_user(email="admin_activity@example.com", superuser=True)
    user = db_session.query(User).filter(User.email == "admin_activity@example.com").first()
    db_session.add(UsageEvent(user_id=user.id, event_type="chef_ai"))
    db_session.commit()

    res = admin_client.get("/admin/activity")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["entries"][0]["user_email"] == "admin_activity@example.com"
    assert data["entries"][0]["event_type"] == "chef_ai"


def test_activity_filters_by_user_id(make_user, db_session):
    from app.models.subscription import UsageEvent
    from app.models.user import User

    admin_client = make_user(email="admin_activity_filter@example.com", superuser=True)
    other_client = make_user(email="outro_activity_filter@example.com")
    admin = db_session.query(User).filter(User.email == "admin_activity_filter@example.com").first()
    other = db_session.query(User).filter(User.email == "outro_activity_filter@example.com").first()

    db_session.add(UsageEvent(user_id=admin.id, event_type="chef_ai"))
    db_session.add(UsageEvent(user_id=other.id, event_type="meal_swap:tok"))
    db_session.add(UsageEvent(user_id=other.id, event_type="meal_swap:tok"))
    db_session.commit()

    res = admin_client.get("/admin/activity", params={"user_id": other.id})
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 2
    assert all(e["user_email"] == "outro_activity_filter@example.com" for e in data["entries"])


def test_payments_requires_superuser(make_user):
    regular_client = make_user(email="naoadmin_payments@example.com")
    res = regular_client.get("/admin/payments")
    assert res.status_code == 403


def test_payments_lists_confirmed_sales(make_user, db_session):
    from app.models.payment import Payment
    from app.models.user import User

    admin_client = make_user(email="admin_payments@example.com", superuser=True)
    user = db_session.query(User).filter(User.email == "admin_payments@example.com").first()
    db_session.add(Payment(user_id=user.id, mp_payment_id="pay-a", plan="plus", amount_brl=29.9, status="approved"))
    db_session.add(Payment(user_id=user.id, mp_payment_id="pay-b", plan="pro", amount_brl=59.9, status="rejected"))
    db_session.commit()

    res = admin_client.get("/admin/payments")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 2
    statuses = {e["status"] for e in data["entries"]}
    assert statuses == {"approved", "rejected"}


def test_top_users_requires_superuser(make_user):
    regular_client = make_user(email="naoadmin_topusers@example.com")
    res = regular_client.get("/admin/top-users")
    assert res.status_code == 403


def test_top_users_ranks_by_activity_count(make_user, db_session):
    from app.models.subscription import UsageEvent
    from app.models.user import User

    admin_client = make_user(email="admin_topusers@example.com", superuser=True)
    heavy_client = make_user(email="heavy_topusers@example.com")
    light_client = make_user(email="light_topusers@example.com")
    heavy = db_session.query(User).filter(User.email == "heavy_topusers@example.com").first()
    light = db_session.query(User).filter(User.email == "light_topusers@example.com").first()

    for _ in range(3):
        db_session.add(UsageEvent(user_id=heavy.id, event_type="chef_ai"))
    db_session.add(UsageEvent(user_id=light.id, event_type="chef_ai"))
    db_session.commit()

    res = admin_client.get("/admin/top-users")
    assert res.status_code == 200
    entries = res.json()["entries"]
    assert entries[0]["user_email"] == "heavy_topusers@example.com"
    assert entries[0]["actions_count"] == 3


def test_metrics_includes_confirmed_revenue(make_user, db_session):
    from app.models.payment import Payment
    from app.models.user import User

    admin_client = make_user(email="admin_revenue@example.com", superuser=True)
    user = db_session.query(User).filter(User.email == "admin_revenue@example.com").first()
    db_session.add(Payment(user_id=user.id, mp_payment_id="pay-rev-1", plan="plus", amount_brl=29.9, status="approved"))
    db_session.add(Payment(user_id=user.id, mp_payment_id="pay-rev-2", plan="pro", amount_brl=59.9, status="rejected"))
    db_session.commit()

    res = admin_client.get("/admin/metrics")
    data = res.json()
    # Só soma pagamentos aprovados na receita confirmada.
    assert data["revenue_confirmed_brl"] == 29.9
    assert data["payments_last_30_days"] == 2


def test_admin_feedback_requires_superuser(make_user):
    regular_client = make_user(email="naoadmin_feedback@example.com")
    res = regular_client.get("/admin/feedback")
    assert res.status_code == 403


def test_admin_feedback_lists_tickets(make_user, db_session):
    from app.models.feedback import FeedbackTicket
    from app.models.user import User

    admin_client = make_user(email="admin_feedbacklist@example.com", superuser=True)
    user = db_session.query(User).filter(User.email == "admin_feedbacklist@example.com").first()
    db_session.add(FeedbackTicket(user_id=user.id, email=user.email, category="bug", message="Algo quebrou."))
    db_session.commit()

    res = admin_client.get("/admin/feedback")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["entries"][0]["category"] == "bug"


def test_admin_feedback_filters_by_user_id(make_user, db_session):
    from app.models.feedback import FeedbackTicket
    from app.models.user import User

    admin_client = make_user(email="admin_feedbackfiltro@example.com", superuser=True)
    other_client = make_user(email="outro_feedbackfiltro@example.com")
    admin = db_session.query(User).filter(User.email == "admin_feedbackfiltro@example.com").first()
    other = db_session.query(User).filter(User.email == "outro_feedbackfiltro@example.com").first()

    db_session.add(FeedbackTicket(user_id=admin.id, email=admin.email, category="duvida", message="Chamado do admin."))
    db_session.add(FeedbackTicket(user_id=other.id, email=other.email, category="bug", message="Chamado do outro."))
    db_session.commit()

    res = admin_client.get("/admin/feedback", params={"user_id": other.id})
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["entries"][0]["message"] == "Chamado do outro."
