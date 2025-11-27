from pydantic import BaseModel, ConfigDict
from datetime import datetime

class WeightHistoryBase(BaseModel):
    weight: float

class WeightHistoryCreate(WeightHistoryBase):
    pass

class WeightHistoryResponse(WeightHistoryBase):
    id: int
    date: datetime
    model_config = ConfigDict(from_attributes=True)