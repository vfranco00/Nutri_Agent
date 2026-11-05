"""Schemas do Agente Nuvi (`POST /agent/parse`).

Contrato em `docs/superpowers/plans/2026-11-05-nuvi-agente.md`. Espelha os tipos
`AgentParse*` de `frontend/src/types.ts`.
"""

import re
from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.diary import (
    DiaryUnitType,
    FoodOption,
    MealSlotType,
    _validar_janela_data,
    _validar_nome_alimento,
)

# Quebra de linha é normal num chat; o resto dos bytes de controle não é (RS-08).
_CONTROLE_SEM_QUEBRA = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

# O teto do JSON é do base64, que cresce 4/3 sobre o binário. Um pouco acima do teto
# decodificado para que a imagem grande demais chegue até o 413 explicativo da rota em vez
# de virar 422 de tamanho de campo. O que passar disso é abuso, e 422 serve.
MAX_IMAGE_B64_CHARS = 6_000_000


class AgentParseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: Optional[str] = Field(default=None, max_length=500)
    image_base64: Optional[str] = Field(default=None, max_length=MAX_IMAGE_B64_CHARS)
    date: date
    meal_slot: Optional[MealSlotType] = None

    @field_validator("text")
    @classmethod
    def texto_limpo(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        if _CONTROLE_SEM_QUEBRA.search(v):
            raise ValueError("Texto inválido.")
        v = " ".join(v.split())
        return v or None

    @field_validator("date")
    @classmethod
    def data_na_janela(cls, v: date) -> date:
        return _validar_janela_data(v)

    @model_validator(mode="after")
    def texto_ou_foto(self) -> "AgentParseRequest":
        if not self.text and not self.image_base64:
            raise ValueError("Escreva o que você comeu ou mande uma foto.")
        return self


class ItemExtraido(BaseModel):
    """Um item como o Gemini o devolveu, já validado. Nunca vai para a resposta direto."""

    model_config = ConfigDict(extra="ignore")

    name: str = Field(min_length=1, max_length=120)
    quantity: float = Field(gt=0, le=10_000)
    unit: DiaryUnitType

    @field_validator("name")
    @classmethod
    def nome_plausivel(cls, v: str) -> str:
        return _validar_nome_alimento(v)


class ExtracaoAgente(BaseModel):
    meal_slot: Optional[MealSlotType] = None
    items: list[ItemExtraido] = Field(default_factory=list)


class AgentParsedItem(BaseModel):
    # Como o agente entendeu o item; é o termo que o botão "Buscar" leva para a busca.
    name: str
    # None = nada no catálogo nem no cache. O cliente oferece a busca, não o Confirmar.
    food: Optional[FoodOption] = None
    quantity: float
    unit: DiaryUnitType
    confidence: Literal["alta", "baixa"]
    # Até 5 opções da busca do catálogo quando a confiança é baixa.
    alternatives: list[FoodOption] = Field(default_factory=list)


class AgentParseResponse(BaseModel):
    date: date
    meal_slot: Optional[MealSlotType] = None
    items: list[AgentParsedItem]
