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
