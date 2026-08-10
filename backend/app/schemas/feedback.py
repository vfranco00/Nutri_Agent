from pydantic import BaseModel, EmailStr, Field
from typing import Literal, Optional

FeedbackCategory = Literal["duvida", "bug", "sugestao", "outro"]


class FeedbackRequest(BaseModel):
    # Rota pública sem sessão: `name` sem teto era campo livre de tamanho ilimitado
    # gravado direto no banco por qualquer visitante, e ainda entra no corpo do email
    # de notificação. `message` já tinha teto; `name` e `email` não tinham.
    name: Optional[str] = Field(default=None, max_length=120)
    email: EmailStr = Field(max_length=254)
    category: FeedbackCategory = "outro"
    message: str = Field(min_length=10, max_length=4000)
