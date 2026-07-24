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


# ============================================================================
# Seções novas do painel: overview, users/insights, finance, usage, tickets
# ============================================================================

def test_overview_requires_superuser(make_user):
    regular_client = make_user(email="naoadmin_overview@example.com")
    assert regular_client.get("/admin/overview").status_code == 403


def test_overview_reflects_users_and_conversion(make_user):
    admin_client = make_user(email="admin_overview@example.com", superuser=True)
    make_user(email="plus_overview@example.com", plan="plus")
    make_user(email="pro_overview@example.com", plan="pro")

    res = admin_client.get("/admin/overview")
    assert res.status_code == 200
    data = res.json()
    # 3 usuários no total (admin starter + plus + pro); 2 pagantes.
    assert data["users_total"] == 3
    assert data["paying_users"] == 2
    # Conversão = 2/3 ≈ 66.7%
    assert data["conversion_rate"] == 66.7
    assert data["mrr_estimate_brl"] == 89.8
    # make_user faz login interno, então esses usuários contam como ativos em 24h.
    assert data["active_24h"] >= 1


def test_overview_counts_open_tickets(make_user, db_session):
    from app.models.feedback import FeedbackTicket
    from app.models.user import User

    admin_client = make_user(email="admin_ov_tickets@example.com", superuser=True)
    user = db_session.query(User).filter(User.email == "admin_ov_tickets@example.com").first()
    db_session.add(FeedbackTicket(user_id=user.id, email=user.email, category="bug", message="Aberto 1.", status="aberto"))
    db_session.add(FeedbackTicket(user_id=user.id, email=user.email, category="bug", message="Resolvido.", status="resolvido"))
    db_session.commit()

    data = admin_client.get("/admin/overview").json()
    assert data["open_tickets"] == 1
    assert data["tickets_7d"] == 2


def test_users_insights_funnel_and_distributions(make_user, db_session):
    from app.models.profile import Profile
    from app.models.subscription import UsageEvent
    from app.models.user import User

    admin_client = make_user(email="admin_insights@example.com", superuser=True)
    admin = db_session.query(User).filter(User.email == "admin_insights@example.com").first()
    db_session.add(Profile(user_id=admin.id, age=30, weight=80, height=180, gender="male",
                           activity_level="moderate", goal="lose_weight", diet_type="omnivore"))
    db_session.add(UsageEvent(user_id=admin.id, event_type="chef_ai"))
    db_session.commit()

    res = admin_client.get("/admin/users/insights")
    assert res.status_code == 200
    data = res.json()
    assert data["funnel"]["total"] == 1
    assert data["funnel"]["with_profile"] == 1
    assert data["funnel"]["with_activity"] == 1
    goals = {g["key"]: g["count"] for g in data["goal_distribution"]}
    assert goals["lose_weight"] == 1
    diets = {d["key"]: d["count"] for d in data["diet_distribution"]}
    assert diets["omnivore"] == 1


def test_finance_requires_superuser(make_user):
    regular_client = make_user(email="naoadmin_finance@example.com")
    assert regular_client.get("/admin/finance").status_code == 403


def test_finance_computes_revenue_arpu_and_status(make_user, db_session):
    from app.models.payment import Payment
    from app.models.user import User

    admin_client = make_user(email="admin_finance@example.com", superuser=True)
    make_user(email="plus_finance@example.com", plan="plus")
    admin = db_session.query(User).filter(User.email == "admin_finance@example.com").first()
    db_session.add(Payment(user_id=admin.id, mp_payment_id="fin-ok", plan="plus", amount_brl=29.9, status="approved"))
    db_session.add(Payment(user_id=admin.id, mp_payment_id="fin-rej", plan="plus", amount_brl=29.9, status="rejected"))
    db_session.commit()

    data = admin_client.get("/admin/finance").json()
    assert data["revenue_confirmed_brl"] == 29.9
    assert data["paying_users"] == 1
    # ARPU = MRR (29.9) / pagantes (1)
    assert data["arpu_brl"] == 29.9
    assert data["avg_ticket_brl"] == 29.9
    status_map = {s["key"]: s["count"] for s in data["payments_by_status"]}
    assert status_map["approved"] == 1
    assert status_map["rejected"] == 1
    assert len(data["revenue_by_month"]) == 12


def test_usage_feature_adoption_and_sources(make_user, db_session):
    from app.models.subscription import UsageEvent
    from app.models.recipe import Recipe
    from app.models.user import User

    admin_client = make_user(email="admin_usage@example.com", superuser=True)
    admin = db_session.query(User).filter(User.email == "admin_usage@example.com").first()
    db_session.add(UsageEvent(user_id=admin.id, event_type="chef_ai"))
    db_session.add(UsageEvent(user_id=admin.id, event_type="generate_plan_daily"))
    db_session.add(Recipe(user_id=admin.id, title="IA Recipe", instructions="...", is_ai=True))
    db_session.add(Recipe(user_id=admin.id, title="Manual Recipe", instructions="...", is_ai=False))
    db_session.commit()

    data = admin_client.get("/admin/usage").json()
    adoption = {a["feature"]: a["users"] for a in data["feature_adoption"]}
    assert adoption["Chef IA"] == 1
    assert adoption["Gerou cardápio"] == 1
    assert adoption["Salvou receita"] == 1
    sources = {s["key"]: s["count"] for s in data["recipes_by_source"]}
    assert sources["IA"] == 1
    assert sources["Manual"] == 1


def test_feedback_filters_by_status_and_category(make_user, db_session):
    from app.models.feedback import FeedbackTicket
    from app.models.user import User

    admin_client = make_user(email="admin_ticketfilter@example.com", superuser=True)
    user = db_session.query(User).filter(User.email == "admin_ticketfilter@example.com").first()
    db_session.add(FeedbackTicket(user_id=user.id, email=user.email, category="bug", message="Bug aberto.", status="aberto"))
    db_session.add(FeedbackTicket(user_id=user.id, email=user.email, category="duvida", message="Dúvida resolvida.", status="resolvido"))
    db_session.commit()

    only_open = admin_client.get("/admin/feedback", params={"status": "aberto"}).json()
    assert only_open["total"] == 1
    assert only_open["entries"][0]["category"] == "bug"

    only_duvida = admin_client.get("/admin/feedback", params={"category": "duvida"}).json()
    assert only_duvida["total"] == 1
    assert only_duvida["entries"][0]["status"] == "resolvido"


def test_feedback_summary_breakdowns(make_user, db_session):
    from app.models.feedback import FeedbackTicket
    from app.models.user import User

    admin_client = make_user(email="admin_ticketsummary@example.com", superuser=True)
    user = db_session.query(User).filter(User.email == "admin_ticketsummary@example.com").first()
    db_session.add(FeedbackTicket(user_id=user.id, email=user.email, category="bug", message="B1", status="aberto"))
    db_session.add(FeedbackTicket(user_id=user.id, email=user.email, category="bug", message="B2", status="resolvido"))
    db_session.add(FeedbackTicket(user_id=user.id, email=user.email, category="sugestao", message="S1", status="aberto"))
    db_session.commit()

    data = admin_client.get("/admin/feedback/summary").json()
    assert data["open_total"] == 2
    assert data["resolved_total"] == 1
    cats = {c["key"]: c["count"] for c in data["category_breakdown"]}
    assert cats["bug"] == 2
    assert cats["sugestao"] == 1


def test_update_ticket_status_resolves_and_reopens(make_user, db_session):
    from app.models.feedback import FeedbackTicket
    from app.models.user import User

    admin_client = make_user(email="admin_resolveticket@example.com", superuser=True)
    user = db_session.query(User).filter(User.email == "admin_resolveticket@example.com").first()
    ticket = FeedbackTicket(user_id=user.id, email=user.email, category="bug", message="Resolver.", status="aberto")
    db_session.add(ticket)
    db_session.commit()
    ticket_id = ticket.id

    resolved = admin_client.put(f"/admin/feedback/{ticket_id}/status", json={"status": "resolvido"})
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "resolvido"
    assert resolved.json()["resolved_at"] is not None

    reopened = admin_client.put(f"/admin/feedback/{ticket_id}/status", json={"status": "aberto"})
    assert reopened.status_code == 200
    assert reopened.json()["status"] == "aberto"
    assert reopened.json()["resolved_at"] is None


def test_update_ticket_status_404_for_missing(make_user):
    admin_client = make_user(email="admin_ticket404@example.com", superuser=True)
    res = admin_client.put("/admin/feedback/999999/status", json={"status": "resolvido"})
    assert res.status_code == 404


def test_update_ticket_status_requires_superuser(make_user, db_session):
    from app.models.feedback import FeedbackTicket
    from app.models.user import User

    regular_client = make_user(email="naoadmin_ticket@example.com")
    user = db_session.query(User).filter(User.email == "naoadmin_ticket@example.com").first()
    ticket = FeedbackTicket(user_id=user.id, email=user.email, category="bug", message="X", status="aberto")
    db_session.add(ticket)
    db_session.commit()

    res = regular_client.put(f"/admin/feedback/{ticket.id}/status", json={"status": "resolvido"})
    assert res.status_code == 403
