from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.shopping import ShoppingList, ShoppingItem
from app.schemas.shopping import ShoppingListCreate, ShoppingListResponse, ShoppingItemCreate, ShoppingItemResponse

router = APIRouter()

# --- LISTAS ---

@router.get("/", response_model=list[ShoppingListResponse])
def get_lists(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(ShoppingList).filter(ShoppingList.user_id == current_user.id).order_by(ShoppingList.created_at.desc()).all()

@router.post("/", response_model=ShoppingListResponse)
def create_list(
    list_data: ShoppingListCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    # Cria a lista
    db_list = ShoppingList(title=list_data.title, user_id=current_user.id)
    db.add(db_list)
    db.commit()
    db.refresh(db_list)
    
    # Adiciona itens iniciais se houver
    for item in list_data.items:
        db_item = ShoppingItem(name=item.name, checked=item.checked, list_id=db_list.id)
        db.add(db_item)
    
    db.commit()
    db.refresh(db_list)
    return db_list

@router.delete("/{list_id}")
def delete_list(list_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_list = db.query(ShoppingList).filter(ShoppingList.id == list_id, ShoppingList.user_id == current_user.id).first()
    if not db_list:
        raise HTTPException(status_code=404, detail="Lista não encontrada")
    db.delete(db_list)
    db.commit()
    return {"message": "Lista deletada"}

# --- ITENS (Adicionar/Remover/Marcar) ---

@router.post("/{list_id}/items", response_model=ShoppingItemResponse)
def add_item(
    list_id: int, 
    item_data: ShoppingItemCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    # Verifica se a lista pertence ao usuário
    db_list = db.query(ShoppingList).filter(ShoppingList.id == list_id, ShoppingList.user_id == current_user.id).first()
    if not db_list:
        raise HTTPException(status_code=404, detail="Lista não encontrada")
        
    db_item = ShoppingItem(**item_data.model_dump(), list_id=list_id)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.patch("/items/{item_id}/toggle", response_model=ShoppingItemResponse)
def toggle_item_check(
    item_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    # Join para garantir que o item pertence a uma lista do usuário
    db_item = db.query(ShoppingItem).join(ShoppingList).filter(
        ShoppingItem.id == item_id, 
        ShoppingList.user_id == current_user.id
    ).first()
    
    if not db_item:
        raise HTTPException(status_code=404, detail="Item não encontrado")
        
    db_item.checked = not db_item.checked
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/items/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_item = db.query(ShoppingItem).join(ShoppingList).filter(
        ShoppingItem.id == item_id, 
        ShoppingList.user_id == current_user.id
    ).first()
    
    if not db_item:
        raise HTTPException(status_code=404, detail="Item não encontrado")
        
    db.delete(db_item)
    db.commit()
    return {"message": "Item deletado"}