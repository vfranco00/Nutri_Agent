"""Constantes jurídicas do Nuvi (LGPD). Mudou o texto da política? Suba a versão."""
from typing import Literal, get_args

POLICY_VERSION = "2026-11-v1"

Purpose = Literal["saude", "ia", "push", "ranking", "marketing"]
PURPOSES: tuple[str, ...] = get_args(Purpose)
REQUIRED_PURPOSES = ("saude",)

ConsentSource = Literal["cadastro", "primeiro_uso", "perfil"]

MSG_MENOR_DE_IDADE = "O Nuvi é para maiores de 18 anos."
