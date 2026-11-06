"""Semeia dados de um usuário em TODAS as áreas que a exportação e a exclusão cobrem."""
from datetime import date, datetime

from app.models.diary import DiaryEntry
from app.models.feedback import FeedbackTicket
from app.models.food_cache import FoodCache
from app.models.meal_plan import MealPlan, MealPlanDay
from app.models.payment import Payment
from app.models.profile import Profile
from app.models.push_subscription import PushSubscription
from app.models.recipe import Recipe
from app.models.subscription import Subscription, UsageEvent
from app.models.water import WaterEntry
from app.models.weight_history import WeightHistory


def semear(db, user, *, mp_id="PRE-123", sufixo="a"):
    uid = user.id
    sub = db.query(Subscription).filter(Subscription.user_id == uid).first()
    if sub is None:
        sub = Subscription(user_id=uid, plan="plus", status="active")
        db.add(sub)
    sub.mp_subscription_id = mp_id
    db.add_all([
        Profile(user_id=uid, age=30, weight=70.0, height=170.0, gender="H",
                activity_level="moderate", goal="maintain"),
        WeightHistory(user_id=uid, weight=70.0),
        DiaryEntry(user_id=uid, entry_date=date(2026, 11, 1), meal_slot="almoco",
                   food_ref="x", food_name="Arroz", source="taco", base_unit="g",
                   quantity=100, unit="g", kcal_per_base_unit=1.3, calories_total=130),
        WaterEntry(user_id=uid, entry_date=date(2026, 11, 1), ml=250),
        Recipe(user_id=uid, title="Receita", instructions="misture"),
        Payment(user_id=uid, mp_payment_id=f"pay-{sufixo}-{uid}", plan="plus",
                amount_brl=19.9, status="approved"),
        UsageEvent(user_id=uid, event_type="chef_ai"),
        FeedbackTicket(user_id=uid, email=user.email, category="duvida", message="oi"),
        PushSubscription(user_id=uid, endpoint=f"https://fcm.googleapis.com/fcm/send/{sufixo}{uid}",
                         p256dh="k", auth="a"),
        FoodCache(name="Pão llm", name_normalized=f"pao llm {sufixo}{uid}", calories_per_unit=2.5,
                  unit_type="g", source="llm", created_by_user_id=uid),
    ])
    plano = MealPlan(user_id=uid, title="Plano", source="manual")
    plano.days.append(MealPlanDay(day_label="Seg", day_index=0))
    db.add(plano)
    db.commit()
