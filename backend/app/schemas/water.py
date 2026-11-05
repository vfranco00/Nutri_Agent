"""Contrato de /water (Frente A). Escrita com `extra="forbid"`, como no diário (RS-02)."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.diary import _validar_janela_data

MAX_ML_POR_REGISTRO = 5000


class WaterEntryCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: date
    # `strict` recusa 2.5 (que o pydantic truncaria para 2) e "250" em string.
    ml: int = Field(gt=0, le=MAX_ML_POR_REGISTRO, strict=True)

    @field_validator("date")
    @classmethod
    def data_na_janela(cls, v: date) -> date:
        return _validar_janela_data(v)


class WaterEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ml: int
    created_at: datetime


class WaterDay(BaseModel):
    date: date
    goal_ml: int
    total_ml: int
    entries: list[WaterEntryResponse]
