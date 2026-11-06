from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.core.legal import ConsentSource, Purpose


class ConsentItem(BaseModel):
    purpose: Purpose
    granted: bool
    at: Optional[datetime] = None


class ConsentState(BaseModel):
    policy_version: str
    items: list[ConsentItem]


class ConsentChange(BaseModel):
    purpose: Purpose
    granted: bool
    source: ConsentSource
