"""Contrato de /push (Frente A). O corpo segue `PushSubscription.toJSON()`."""

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.services.webpush import endpoint_permitido


class PushKeys(BaseModel):
    model_config = ConfigDict(extra="forbid")

    p256dh: str = Field(min_length=1, max_length=255)
    auth: str = Field(min_length=1, max_length=255)


class PushSubscriptionCreate(BaseModel):
    # `toJSON()` pode trazer `expirationTime`; ignoramos o que não usamos.
    model_config = ConfigDict(extra="ignore")

    endpoint: str = Field(min_length=1, max_length=1024)
    keys: PushKeys

    @field_validator("endpoint")
    @classmethod
    def endpoint_seguro(cls, v: str) -> str:
        # SSRF: o backend faz POST neste endereço, então só serviços de push conhecidos.
        if not endpoint_permitido(v):
            raise ValueError("endpoint de push não permitido")
        return v


class PushSubscriptionDelete(BaseModel):
    model_config = ConfigDict(extra="forbid")

    endpoint: str = Field(min_length=1, max_length=1024)


class PushSubscriptionCreated(BaseModel):
    id: int


class VapidPublicKey(BaseModel):
    public_key: str
