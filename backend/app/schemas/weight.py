from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime

class WeightHistoryBase(BaseModel):
    weight: float = Field(gt=0, le=1000)

class WeightHistoryCreate(WeightHistoryBase):
    pass

class WeightHistoryResponse(WeightHistoryBase):
    id: int
    date: datetime
    model_config = ConfigDict(from_attributes=True)