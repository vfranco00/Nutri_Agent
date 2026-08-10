from sqlalchemy import Integer, String, Float, Text, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.db.base_class import Base


class MealPlan(Base):
    __tablename__ = "meal_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, default="Meu Plano Alimentar")
    # "ai": salvo a partir de um cardápio gerado pela IA. "manual": montado escolhendo receitas existentes.
    source: Mapped[str] = mapped_column(String, nullable=False, default="manual")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    days = relationship("MealPlanDay", back_populates="meal_plan", cascade="all, delete-orphan", order_by="MealPlanDay.day_index")


class MealPlanDay(Base):
    __tablename__ = "meal_plan_days"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    meal_plan_id: Mapped[int] = mapped_column(ForeignKey("meal_plans.id"), nullable=False)
    day_label: Mapped[str] = mapped_column(String, nullable=False)
    day_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    calories_target: Mapped[float] = mapped_column(Float, nullable=True)
    macros_protein: Mapped[str] = mapped_column(String, nullable=True)
    macros_carbs: Mapped[str] = mapped_column(String, nullable=True)
    macros_fats: Mapped[str] = mapped_column(String, nullable=True)

    meal_plan = relationship("MealPlan", back_populates="days")
    meals = relationship("MealPlanMeal", back_populates="day", cascade="all, delete-orphan")


class MealPlanMeal(Base):
    __tablename__ = "meal_plan_meals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    meal_plan_day_id: Mapped[int] = mapped_column(ForeignKey("meal_plan_days.id"), nullable=False)
    slot_name: Mapped[str] = mapped_column(String, nullable=False)  # ex: "Café da Manhã", "Almoço"

    # Uma refeição do plano OU aponta pra uma receita existente (fluxo manual)
    # OU carrega um texto livre vindo do cardápio gerado por IA — nunca os dois.
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id"), nullable=True)
    custom_title: Mapped[str] = mapped_column(String, nullable=True)
    custom_description: Mapped[str] = mapped_column(Text, nullable=True)
    calories: Mapped[float] = mapped_column(Float, nullable=True)

    day = relationship("MealPlanDay", back_populates="meals")
    recipe = relationship("Recipe")
