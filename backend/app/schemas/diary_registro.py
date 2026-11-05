"""Schemas do registro rápido (Frente R da Fase 1 Nuvi).

Extensão do contrato do ADR-0001, num arquivo próprio para não engordar
`schemas/diary.py`. Mesmas regras de lá: todo schema de escrita tem `extra="forbid"`
(RS-02), e `user_id` nunca aparece em corpo nenhum.
"""

import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.diary import _validar_nome_alimento

# EAN-8, UPC-A (12), EAN-13 e GTIN-14. Só dígitos: o código não é texto livre.
BARCODE_RE = re.compile(r"^[0-9]{8,14}$")
BARCODE_PATTERN = BARCODE_RE.pattern


def _validar_barcode(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    v = v.strip()
    if not BARCODE_RE.match(v):
        raise ValueError("Código de barras inválido.")
    return v


# --------------------------------------------------------------------------------------
# Alimento pessoal (`mine:<id>`)
# --------------------------------------------------------------------------------------


class UserFoodCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    portion_label: str = Field(default="1 porção", min_length=1, max_length=60)
    portion_grams: Optional[float] = Field(default=None, gt=0, le=5000)
    # Valores da PORÇÃO. `ge=0`: um alimento de 0 kcal (adoçante, chá) é legítimo.
    kcal: float = Field(ge=0, le=5000)
    protein_g: Optional[float] = Field(default=None, ge=0, le=1000)
    carbs_g: Optional[float] = Field(default=None, ge=0, le=1000)
    fat_g: Optional[float] = Field(default=None, ge=0, le=1000)
    barcode: Optional[str] = None

    @field_validator("name")
    @classmethod
    def nome_plausivel(cls, v: str) -> str:
        return _validar_nome_alimento(v)

    @field_validator("portion_label")
    @classmethod
    def rotulo_plausivel(cls, v: str) -> str:
        return _validar_nome_alimento(v)

    @field_validator("barcode")
    @classmethod
    def barcode_valido(cls, v: Optional[str]) -> Optional[str]:
        return _validar_barcode(v)


class UserFoodUpdate(BaseModel):
    """Parcial. `barcode: null` DESLIGA o código; os demais campos não podem ser limpos
    (`name`, `portion_label` e `kcal` são obrigatórios; macros aceitam null = "não sei")."""

    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    portion_label: Optional[str] = Field(default=None, min_length=1, max_length=60)
    portion_grams: Optional[float] = Field(default=None, gt=0, le=5000)
    kcal: Optional[float] = Field(default=None, ge=0, le=5000)
    protein_g: Optional[float] = Field(default=None, ge=0, le=1000)
    carbs_g: Optional[float] = Field(default=None, ge=0, le=1000)
    fat_g: Optional[float] = Field(default=None, ge=0, le=1000)
    barcode: Optional[str] = None

    @field_validator("name", "portion_label")
    @classmethod
    def texto_plausivel(cls, v: Optional[str]) -> Optional[str]:
        return v if v is None else _validar_nome_alimento(v)

    @field_validator("barcode")
    @classmethod
    def barcode_valido(cls, v: Optional[str]) -> Optional[str]:
        return _validar_barcode(v)

    @model_validator(mode="after")
    def coerente(self) -> "UserFoodUpdate":
        if not self.model_fields_set:
            raise ValueError("Informe ao menos um campo para atualizar.")
        for obrigatorio in ("name", "portion_label", "kcal"):
            if obrigatorio in self.model_fields_set and getattr(self, obrigatorio) is None:
                raise ValueError(f"O campo {obrigatorio} não pode ficar vazio.")
        return self


class UserFoodResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    food_ref: str
    name: str
    portion_label: str
    portion_grams: Optional[float] = None
    kcal: float
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    barcode: Optional[str] = None
    created_at: datetime


class UserFoodList(BaseModel):
    items: list[UserFoodResponse]
