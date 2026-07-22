from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.core.deps import get_current_user
from app.core.quotas import check_meal_plan_slot
from app.models.user import User
from app.schemas.meal_plan import MealPlanCreate, MealPlanResponse, MealPlanUpdate
from app.crud import meal_plan as crud_meal_plan

router = APIRouter()


@router.get("/", response_model=List[MealPlanResponse])
def list_meal_plans(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return crud_meal_plan.get_meal_plans(db, user_id=current_user.id)


@router.post("/", response_model=MealPlanResponse)
def create_meal_plan(
    meal_plan: MealPlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_meal_plan_slot(db, current_user)
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
