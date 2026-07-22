from pydantic import BaseModel, EmailStr, Field
from typing import Literal, Optional

FeedbackCategory = Literal["duvida", "bug", "sugestao", "outro"]


class FeedbackRequest(BaseModel):
    name: Optional[str] = None
    email: EmailStr
    category: FeedbackCategory = "outro"
    message: str = Field(min_length=10, max_length=4000)
