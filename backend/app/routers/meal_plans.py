from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.core.deps import get_current_user
from app.core.quotas import check_meal_plan_slot
from app.models.recipe import Recipe
from app.models.user import User
from app.schemas.meal_plan import MealPlanCreate, MealPlanResponse, MealPlanUpdate
from app.crud import meal_plan as crud_meal_plan

router = APIRouter()


@router.get("/", response_model=List[MealPlanResponse])
def list_meal_plans(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return crud_meal_plan.get_meal_plans(db, user_id=current_user.id)


def _assert_recipes_are_readable(db: Session, meal_plan: MealPlanCreate, user_id: int) -> None:
    """Cada refeição pode apontar pra uma receita por `recipe_id`, que vem cru do payload.

    Sem esta checagem existe um BOLA: o atacante cria um plano alimentar apontando
    pra IDs de receita que não são dele (1, 2, 3... — são sequenciais) e o GET do
    plano devolve `recipe` preenchido com título, calorias e categoria de receitas
    PRIVADAS de outras contas. Enumerar a base inteira de receitas é um laço simples.
    Só passa o que ele já poderia ler: receita dele, ou receita publicada na comunidade.
    """
    referenced = {
        meal.recipe_id
        for day in meal_plan.days
        for meal in day.meals
        if meal.recipe_id is not None
    }
    if not referenced:
        return

    readable = {
        rid
        for (rid,) in db.query(Recipe.id).filter(
            Recipe.id.in_(referenced),
            or_(Recipe.user_id == user_id, Recipe.is_public.is_(True)),
        )
    }
    unauthorized = referenced - readable
    if unauthorized:
        # 404 e não 403: confirmar "existe, mas não é sua" já é o vazamento que
        # estamos fechando (permite mapear quais IDs de receita existem).
        raise HTTPException(
            status_code=404,
            detail="Receita não encontrada em uma das refeições do plano.",
        )


@router.post("/", response_model=MealPlanResponse)
def create_meal_plan(
    meal_plan: MealPlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_meal_plan_slot(db, current_user)
    _assert_recipes_are_readable(db, meal_plan, current_user.id)
    return crud_meal_plan.create_meal_plan(db, meal_plan=meal_plan, user_id=current_user.id)


@router.get("/{meal_plan_id}", response_model=MealPlanResponse)
def get_meal_plan(
    meal_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_plan = crud_meal_plan.get_meal_plan_by_id(db, meal_plan_id=meal_plan_id, user_id=current_user.id)
    if not db_plan:
        raise HTTPException(status_code=404, detail="Plano alimentar não encontrado")
    return db_plan


@router.patch("/{meal_plan_id}", response_model=MealPlanResponse)
def rename_meal_plan(
    meal_plan_id: int,
    data: MealPlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_plan = crud_meal_plan.get_meal_plan_by_id(db, meal_plan_id=meal_plan_id, user_id=current_user.id)
    if not db_plan:
        raise HTTPException(status_code=404, detail="Plano alimentar não encontrado")
    return crud_meal_plan.update_meal_plan_title(db, db_plan, data.title)


@router.delete("/{meal_plan_id}")
def delete_meal_plan(
    meal_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_plan = crud_meal_plan.get_meal_plan_by_id(db, meal_plan_id=meal_plan_id, user_id=current_user.id)
    if not db_plan:
        raise HTTPException(status_code=404, detail="Plano alimentar não encontrado")
    crud_meal_plan.delete_meal_plan(db, db_plan)
    return {"message": "Plano alimentar deletado"}
