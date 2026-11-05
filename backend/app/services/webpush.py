"""Envio de push Web (VAPID). Único ponto que fala com `pywebpush` — os testes trocam
`send_push` por um falso."""

import logging
from typing import Literal
from urllib.parse import urlsplit

from pywebpush import WebPushException, webpush

from app.core.config import settings
from app.models.push_subscription import PushSubscription

logger = logging.getLogger(__name__)

PushResult = Literal["ok", "gone", "error"]

# Hosts exatos e sufixos (com o ponto) de serviços de push conhecidos.
_HOSTS_EXATOS = {"fcm.googleapis.com", "web.push.apple.com"}
_SUFIXOS = (".push.services.mozilla.com", ".push.apple.com", ".notify.windows.com")


def endpoint_permitido(url: str) -> bool:
    try:
        partes = urlsplit(url)
        host = (partes.hostname or "").lower()
        porta = partes.port
    except ValueError:
        return False
    if partes.scheme != "https" or not host or partes.username or partes.password:
        return False
    if porta not in (None, 443):
        return False
    return host in _HOSTS_EXATOS or host.endswith(_SUFIXOS)


def send_push(sub: PushSubscription, payload: dict) -> PushResult:
    import json

    try:
        webpush(
            subscription_info={
                "endpoint": sub.endpoint,
                "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
            },
            data=json.dumps(payload),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_SUBJECT},
            ttl=3600,
            timeout=5,
        )
        return "ok"
    except WebPushException as exc:
        status = getattr(getattr(exc, "response", None), "status_code", None)
        if status in (404, 410):
            return "gone"
        # Sem o endpoint completo no log: ele identifica o navegador da pessoa.
        logger.warning("Falha no push (status=%s, host=%s)", status, urlsplit(sub.endpoint).hostname)
        return "error"
    except Exception:
        logger.warning("Falha inesperada no push (host=%s)", urlsplit(sub.endpoint).hostname)
        return "error"
