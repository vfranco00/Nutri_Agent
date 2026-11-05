"""Código de barras: mine do usuário → cache escopado → Open Food Facts.

Grátis em todos os planos (spec da Fase 1, §7 item 3): este caminho NÃO chama o LLM e NÃO
mexe na cota `diary_food_resolve`. A única chamada externa é à Open Food Facts, que é
gratuita, e o resultado fica no `food_cache` do próprio usuário.

A OFF é fonte NÃO confiável (RS-21): é um wiki que qualquer pessoa edita. Por isso:
- a linha é `source="openfoodfacts"`, isolada por `created_by_user_id` (RS-17);
- kcal passa pela faixa de plausibilidade do RS-18, e quem reprova não é gravado;
- macro fora de [0, 1] g/g vira `None` ("não sei"), nunca zero (§ 9.4 do ADR-0001);
- `off_product_id` guarda o código, então um valor ruim é rastreável e removível em lote.

Chave da linha: `name_normalized = "barcode:<código>"`, e não o nome do produto. Assim
dois produtos de nome igual não colidem no `uq_food_cache_private`, e o resolve por nome
nunca devolve uma linha de código de barras por coincidência de nome.

RS-26: nenhum log recebe o código nem o nome do produto. O código identifica o que a
pessoa come.
"""

import logging
import re
from dataclasses import dataclass
from typing import Any, Callable, Optional

import httpx
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.food_cache import FoodCache
from app.schemas.diary import FoodOption
from app.services import diary_foods, diary_math

logger = logging.getLogger(__name__)

OFF_BARCODE_TIMEOUT_SECONDS = 5.0
OFF_PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product/{code}.json"
OFF_FIELDS = (
    "code,product_name,product_name_pt,generic_name,nutriments,product_quantity_unit"
)
# EAN-8, UPC-A (12), EAN-13 e GTIN-14. Só dígitos: a URL externa nunca é montada a partir
# de texto livre.
CODIGO_VALIDO = re.compile(r"^\d{8,14}$")
NOME_MAX = 120
_CONTROLE = re.compile(r"[\x00-\x1f\x7f]+")
_UNIDADES_LIQUIDAS = {"ml", "l", "cl", "dl"}

# Gancho da Frente R: `(db, user_id, code) -> FoodOption | None` para o `mine` do usuário.
# Fica `None` até o contrato `/diary/foods/mine` com `barcode` estar na main.
buscar_no_mine: Optional[Callable[[Session, int, str], Optional[FoodOption]]] = None


class BarcodeNotFound(Exception):
    """Nenhuma fonte tem o produto, ou o valor dele reprovou na plausibilidade."""


class BarcodeUnavailable(Exception):
    """Open Food Facts lenta ou fora do ar. Falha não se disfarça de "não existe" (Δ3)."""


@dataclass(frozen=True)
class ProdutoOff:
    nome: str
    base_unit: str  # "g" | "ml"
    kcal: float  # por 1 g ou 1 ml
    proteina: Optional[float]
    carbo: Optional[float]
    gordura: Optional[float]


def _novo_cliente() -> httpx.Client:
    """Separado para os testes trocarem o transporte; nenhum teste sai para a rede."""
    return httpx.Client()


def _numero(valor: Any) -> Optional[float]:
    try:
        numero = float(valor)
    except (TypeError, ValueError):
        return None
    return numero


def _macro_por_grama(valor: Any) -> Optional[float]:
    por_100 = _numero(valor)
    if por_100 is None or not 0 <= por_100 <= 100:
        return None
    return round(por_100 / 100, 6)


def _nome_limpo(produto: dict, code: str) -> str:
    for campo in ("product_name_pt", "product_name", "generic_name"):
        bruto = produto.get(campo)
        if isinstance(bruto, str):
            limpo = " ".join(_CONTROLE.sub(" ", bruto).split())[:NOME_MAX].strip()
            if limpo:
                return limpo
    return f"Produto {code}"


def buscar_produto_off(code: str) -> Optional[ProdutoOff]:
    """Consulta a OFF pelo código. `None` = produto inexistente ou sem kcal utilizável."""
    try:
        with _novo_cliente() as client:
            response = client.get(
                OFF_PRODUCT_URL.format(code=code),
                params={"fields": OFF_FIELDS},
                timeout=OFF_BARCODE_TIMEOUT_SECONDS,
            )
    except httpx.HTTPError as exc:
        raise BarcodeUnavailable() from exc

    if response.status_code >= 500:
        raise BarcodeUnavailable()
    if response.status_code != 200:
        return None
    try:
        corpo = response.json()
    except ValueError as exc:
        raise BarcodeUnavailable() from exc

    produto = corpo.get("product") if isinstance(corpo, dict) else None
    if corpo.get("status") != 1 or not isinstance(produto, dict):
        return None

    nutrientes = produto.get("nutriments") or {}
    kcal_100 = _numero(nutrientes.get("energy-kcal_100g"))
    if kcal_100 is None:
        return None

    unidade = str(produto.get("product_quantity_unit") or "").strip().lower()
    base_unit = "ml" if unidade in _UNIDADES_LIQUIDAS else "g"
    return ProdutoOff(
        nome=_nome_limpo(produto, code),
        base_unit=base_unit,
        kcal=round(kcal_100 / 100, 6),
        proteina=_macro_por_grama(nutrientes.get("proteins_100g")),
        carbo=_macro_por_grama(nutrientes.get("carbohydrates_100g")),
        gordura=_macro_por_grama(nutrientes.get("fat_100g")),
    )


def _ler_cache(db: Session, user_id: int, code: str) -> Optional[FoodCache]:
    # RS-17: o escopo mora no WHERE. Linha da OFF nunca é compartilhada.
    return (
        db.query(FoodCache)
        .filter(
            FoodCache.source == "openfoodfacts",
            FoodCache.off_product_id == code,
            FoodCache.created_by_user_id == user_id,
        )
        .first()
    )


def _opcao_efemera(produto: ProdutoOff) -> FoodOption:
    """Acima do teto diário de escrita: devolvido, não gravado (igual ao resolve).
    `cache:0` não resolve no POST /diary, de propósito."""
    return FoodOption(
        food_ref="cache:0",
        name=produto.nome,
        base_unit=produto.base_unit,
        kcal_per_base_unit=produto.kcal,
        protein_per_base_unit=produto.proteina,
        carbs_per_base_unit=produto.carbo,
        fat_per_base_unit=produto.gordura,
        allowed_units=diary_math.allowed_units(produto.base_unit),
        source="openfoodfacts",
        is_estimate=True,
    )


def _gravar(db: Session, user_id: int, code: str, produto: ProdutoOff) -> FoodCache:
    linha = FoodCache(
        name=produto.nome,
        name_normalized=f"barcode:{code}",
        unit_type=produto.base_unit,
        calories_per_unit=produto.kcal,
        source="openfoodfacts",
        created_by_user_id=user_id,
        off_product_id=code,
        protein_per_base_unit=produto.proteina,
        carbs_per_base_unit=produto.carbo,
        fat_per_base_unit=produto.gordura,
    )
    db.add(linha)
    try:
        db.commit()
    except IntegrityError:
        # Duas leituras simultâneas do mesmo código pelo mesmo usuário: a outra gravou
        # primeiro. Vale a linha dela.
        db.rollback()
        existente = _ler_cache(db, user_id, code)
        if existente is None:
            raise
        return existente
    db.refresh(linha)
    return linha


def buscar_por_codigo(db: Session, user_id: int, code: str) -> FoodOption:
    """Devolve o `FoodOption` do código, ou levanta `BarcodeNotFound`/`BarcodeUnavailable`.

    `code` já chega validado pela rota (`CODIGO_VALIDO`); a checagem aqui é defesa em
    profundidade, para que nenhum chamador monte a URL externa com texto livre.
    """
    if not CODIGO_VALIDO.match(code):
        raise BarcodeNotFound()

    # (1) alimento pessoal do usuário com esse código (Frente R)
    if buscar_no_mine is not None:
        do_mine = buscar_no_mine(db, user_id, code)
        if do_mine is not None:
            return do_mine

    # (2) cache do próprio usuário
    linha = _ler_cache(db, user_id, code)
    if linha is not None:
        opcao = diary_foods.opcao_do_cache(linha)
        if opcao is not None:
            return opcao

    # (3) Open Food Facts
    produto = buscar_produto_off(code)
    if produto is None:
        raise BarcodeNotFound()
    if not diary_foods.kcal_plausivel(produto.kcal, produto.base_unit):
        logger.warning(
            "diary_barcode_rejected user_id=%s source=openfoodfacts motivo=implausivel",
            user_id,
        )
        raise BarcodeNotFound()

    if not diary_foods._pode_gravar_cache(db, user_id):
        return _opcao_efemera(produto)

    linha = _gravar(db, user_id, code, produto)
    opcao = diary_foods.opcao_do_cache(linha)
    assert opcao is not None, "linha recem-gravada com unit_type invalido"
    return opcao
