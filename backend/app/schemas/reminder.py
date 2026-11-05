"""Contrato de /reminders (Frente A). Escrita com `extra="forbid"`."""

import re
from datetime import time
from zoneinfo import available_timezones

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.models.reminder import REMINDER_KINDS

_HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


class ReminderItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: str
    time: str
    enabled: bool

    @field_validator("kind")
    @classmethod
    def tipo_conhecido(cls, v: str) -> str:
        if v not in REMINDER_KINDS:
            raise ValueError(f"tipo de lembrete desconhecido: {v}")
        return v

    @field_validator("time")
    @classmethod
    def hora_valida(cls, v: str) -> str:
        if not _HHMM.match(v):
            raise ValueError("horário deve estar no formato HH:MM")
        return v

    def as_time(self) -> time:
        h, m = self.time.split(":")
        return time(int(h), int(m))


class RemindersUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    timezone: str
    reminders: list[ReminderItem]

    @field_validator("timezone")
    @classmethod
    def fuso_valido(cls, v: str) -> str:
        if v not in available_timezones():
            raise ValueError("fuso horário inválido")
        return v

    @model_validator(mode="after")
    def sem_tipo_repetido(self):
        tipos = [r.kind for r in self.reminders]
        if len(tipos) != len(set(tipos)):
            raise ValueError("tipo de lembrete repetido")
        return self


class RemindersResponse(BaseModel):
    timezone: str
    reminders: list[ReminderItem]
