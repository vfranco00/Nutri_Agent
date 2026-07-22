from sqlalchemy.orm import Session
from app.models.meal_plan import MealPlan, MealPlanDay, MealPlanMeal
from app.schemas.meal_plan import MealPlanCreate


def create_meal_plan(db: Session, meal_plan: MealPlanCreate, user_id: int) -> MealPlan:
    db_plan = MealPlan(title=meal_plan.title, source=meal_plan.source, user_id=user_id)
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)

    for day in meal_plan.days:
        db_day = MealPlanDay(
            meal_plan_id=db_plan.id,
            day_label=day.day_label,
            day_index=day.day_index,
            calories_target=day.calories_target,
            macros_protein=day.macros_protein,
            macros_carbs=day.macros_carbs,
            macros_fats=day.macros_fats,
        )
        db.add(db_day)
        db.commit()
        db.refresh(db_day)

        for meal in day.meals:
            db_meal = MealPlanMeal(
                meal_plan_day_id=db_day.id,
                slot_name=meal.slot_name,
                recipe_id=meal.recipe_id,
                custom_title=meal.custom_title,
                custom_description=meal.custom_description,
                calories=meal.calories,
            )
            db.add(db_meal)

    db.commit()
    db.refresh(db_plan)
    return db_plan


def get_meal_plans(db: Session, user_id: int):
    return db.query(MealPlan).filter(MealPlan.user_id == user_id).order_by(MealPlan.created_at.desc()).all()


def get_meal_plan_by_id(db: Session, meal_plan_id: int, user_id: int) -> MealPlan | None:
    return db.query(MealPlan).filter(MealPlan.id == meal_plan_id, MealPlan.user_id == user_id).first()


def delete_meal_plan(db: Session, db_plan: MealPlan):
    db.delete(db_plan)
    db.commit()


def update_meal_plan_title(db: Session, db_plan: MealPlan, title: str) -> MealPlan:
    db_plan.title = title
    db.commit()
    db.refresh(db_plan)
    return db_plan
