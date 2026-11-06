import re

from app.models.reminder import REMINDER_KINDS
from app.services.reminder_dispatch import _payload


def test_payload_push_sem_dado_de_saude():
    for kind in REMINDER_KINDS:
        p = _payload(kind)
        texto = f"{p['title']} {p['body']}"
        assert not re.search(r"\d", texto), texto  # nenhum número (kcal, kg, meta)
        for proibido in ("kcal", "caloria", "meta", "kg", "abaixo", "acima"):
            assert proibido not in texto.lower(), (kind, proibido)
        assert p["title"].startswith("Hora de ")
