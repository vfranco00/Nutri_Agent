"""Código de barras: mine do usuário → cache escopado → Open Food Facts.

Grátis em todos os planos (spec da Fase 1, §7 item 3): este caminho NÃO chama o LLM e NÃO
mexe na cota `diary_food_resolve`. A única chamada externa é à Open Food Facts, que é
gratuita, e o resultado fica no `food_cache` do próprio usuário.

A OFF é fonte NÃO confiável (RS-21): é um wiki que qualquer pessoa edita. Por isso:
- a linha é `source="openfoodfacts"`, isolada por `created_by_user_id` (RS-17);
- kcal passa pela faixa de plausibilidade do RS-18, e quem reprova não é gravado;
- macro fora de [0, 1] g/g vira `None` ("não sei"), nunca zero (§ 9.4 do ADR-0001);
- `off_product_id` guarda o código, então um valor ruim é rastreável e removível em lote.

Chave da linha: `name_normalized = "barcode:v2:<código>"`, e não o nome do produto. Assim
dois produtos de nome igual não colidem no `uq_food_cache_private`, e o resolve por nome
nunca devolve uma linha de código de barras por coincidência de nome.

O "v2" é a versão do mapeamento (kcal conferida contra kJ, líquido em ml, tamanhos da
embalagem). Linha gravada pela versão anterior ("barcode:<código>") é rebaixada na próxima
leitura: busca-se de novo na OFF e a linha é reescrita no lugar, mantendo o `id`.

Líquido x sólido: a tabela só guarda UM número por unidade base. Para ml usamos densidade
1 g/ml (1 ml = 1 g) quando algum cálculo precisar de gramas; macros e kcal ficam sempre
"por 100 ml" nas bebidas, que é como o rótulo traz.

RS-26: nenhum log recebe o código nem o nome do produto. O código identifica o que a
pessoa come.
"""

import logging
import math
import re
from dataclasses import dataclass
from typing import Any, Callable, Optional

import httpx
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.food_cache import FoodCache
from app.schemas.diary import FoodOption
from app.services import diary_foods, diary_math, diary_registro

logger = logging.getLogger(__name__)

OFF_BARCODE_TIMEOUT_SECONDS = 5.0
OFF_PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product/{code}.json"
OFF_FIELDS = (
    "code,product_name,product_name_pt,generic_name,nutriments,product_quantity_unit,"
    "product_quantity,quantity,serving_size,serving_quantity,nutrition_data_per,"
    "categories_tags"
)
# Versão do mapeamento que gravou a linha (ver docstring do módulo).
CHAVE_VERSAO = "barcode:v2:"
# EAN-8, UPC-A (12), EAN-13 e GTIN-14. Só dígitos: a URL externa nunca é montada a partir
# de texto livre.
CODIGO_VALIDO = re.compile(r"^\d{8,14}$")
NOME_MAX = 120
_CONTROLE = re.compile(r"[\x00-\x1f\x7f]+")
_UNIDADES_LIQUIDAS = {"ml", "l", "cl", "dl"}
# Mililitros por unidade de volume escrita no rótulo.
_ML_POR_UNIDADE = {"ml": 1.0, "cl": 10.0, "dl": 100.0, "l": 1000.0}
_UNIDADES_MASSA = {"g": 1.0, "kg": 1000.0, "mg": 0.001}
_QUANTIDADE = re.compile(r"(\d+(?:[.,]\d+)?)\s*(ml|cl|dl|l|kg|mg|g)\b", re.IGNORECASE)
# Só serve quando o produto não diz a unidade (a unidade explícita sempre vence: um pó para
# preparo de bebida vem em g e continua sólido).
_CATEGORIAS_BEBIDA = {
    "en:beverages",
    "en:drinks",
    "en:waters",
    "en:sodas",
    "en:energy-drinks",
    "en:juices",
    "en:milks",
    "en:non-alcoholic-beverages",
    "en:alcoholic-beverages",
    "en:plant-based-beverages",
    "en:carbonated-drinks",
    "en:sweetened-beverages",
}
# kcal x kJ: 1 kcal = 4,184 kJ.
KJ_POR_KCAL = 4.184
# Tolerância entre o kcal declarado e o kcal derivado do kJ (arredondamento de rótulo).
_TOLERANCIA_KCAL = (0.8, 1.25)
TAMANHO_MAX_EMBALAGEM = 5000.0

# Primeiro passo da cadeia: o alimento pessoal do usuário com esse código (Frente R).
buscar_no_mine: Callable[[Session, int, str], Optional[FoodOption]] = (
    diary_registro.opcao_do_mine_por_barcode
)


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
    # Tamanho da embalagem (lata/garrafa/pacote) e da porção do rótulo, na unidade base.
    embalagem: Optional[float] = None
    porcao: Optional[float] = None


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

    return interpretar_produto(produto, code)


def _positivo(valor: Any, teto: float = TAMANHO_MAX_EMBALAGEM) -> Optional[float]:
    numero = _numero(valor)
    if numero is None or not math.isfinite(numero) or not 0 < numero <= teto:
        return None
    return round(numero, 2)


def _ler_quantidade(texto: Any) -> Optional[tuple[float, str]]:
    """"473 ml" -> (473.0, "ml"); "1,5 L" -> (1500.0, "ml"); "300 g" -> (300.0, "g")."""
    if not isinstance(texto, str):
        return None
    achado = _QUANTIDADE.search(texto)
    if achado is None:
        return None
    numero = float(achado.group(1).replace(",", "."))
    unidade = achado.group(2).lower()
    if unidade in _ML_POR_UNIDADE:
        return numero * _ML_POR_UNIDADE[unidade], "ml"
    return numero * _UNIDADES_MASSA[unidade], "g"


def _base_unit(produto: dict) -> str:
    """"ml" para bebida, "g" para o resto.

    Ordem: (1) `quantity` e `serving_size` com unidade (a embalagem diz o que é);
    (2) `product_quantity_unit`; (3) só então as categorias de bebida.
    """
    for campo in ("quantity", "serving_size"):
        lido = _ler_quantidade(produto.get(campo))
        if lido is not None:
            return lido[1]
    unidade = str(produto.get("product_quantity_unit") or "").strip().lower()
    if unidade in _UNIDADES_LIQUIDAS:
        return "ml"
    if unidade in _UNIDADES_MASSA:
        return "g"
    categorias = produto.get("categories_tags")
    if isinstance(categorias, list) and _CATEGORIAS_BEBIDA.intersection(categorias):
        return "ml"
    return "g"


def _tamanhos(produto: dict, base_unit: str) -> tuple[Optional[float], Optional[float]]:
    """(embalagem, porção) na unidade base. 1 ml = 1 g de água: o modelo guarda um número
    por unidade base e para bebida (densidade ~1 g/ml) as duas coincidem no cálculo."""
    embalagem = None
    lido = _ler_quantidade(produto.get("quantity"))
    if lido is not None and lido[1] == base_unit:
        embalagem = _positivo(lido[0])
    if embalagem is None and str(produto.get("product_quantity_unit") or "").lower() in (
        "ml",
        "g",
    ):
        embalagem = _positivo(produto.get("product_quantity"))
    porcao = _positivo(produto.get("serving_quantity"), teto=2000.0)
    if porcao is None:
        lido = _ler_quantidade(produto.get("serving_size"))
        if lido is not None and lido[1] == base_unit:
            porcao = _positivo(lido[0], teto=2000.0)
    return embalagem, porcao


def _por_100(nutrientes: dict, chave: str, porcao: Optional[float]) -> Optional[float]:
    """Valor por 100 g/ml: `<chave>_100g`; senão converte `<chave>_serving`."""
    valor = _numero(nutrientes.get(f"{chave}_100g"))
    if valor is not None:
        return valor
    por_porcao = _numero(nutrientes.get(f"{chave}_serving"))
    if por_porcao is not None and porcao:
        return por_porcao / porcao * 100
    return None


def _energia(nutrientes: dict, porcao: Optional[float]) -> Optional[tuple[float, float, bool]]:
    """(kcal por 100, fator de correção dos macros, kcal_confiavel).

    Nunca usa kJ como kcal: `energy_100g` é kJ. O kcal declarado é conferido contra o kJ
    (kJ / 4,184). Registro wiki às vezes mistura colunas: kcal e macros por PORÇÃO nas
    colunas `_100g` e kJ por 100 (caso real: 100 kcal / 214 kJ). Quando a razão
    kcal/kcal_do_kJ bate com porção/100, tudo que está em `_100g` é dividido por ela.
    """
    kcal = _por_100(nutrientes, "energy-kcal", porcao)
    kj = _por_100(nutrientes, "energy-kj", porcao)
    if kj is None:
        kj = _por_100(nutrientes, "energy", porcao)
    kcal_do_kj = kj / KJ_POR_KCAL if kj is not None and kj > 0 else None
    if kcal is None:
        return (kcal_do_kj, 1.0, True) if kcal_do_kj is not None else None
    if kcal_do_kj is None or kcal_do_kj < 5:
        return kcal, 1.0, True
    razao = kcal / kcal_do_kj
    if _TOLERANCIA_KCAL[0] <= razao <= _TOLERANCIA_KCAL[1]:
        return kcal, 1.0, True
    if porcao and razao > _TOLERANCIA_KCAL[1]:
        esperado = porcao / 100
        if abs(razao - esperado) / esperado <= 0.2:
            return kcal / esperado, esperado, True
    # Inconsistente sem explicação: o kJ desempata, e os macros só ficam se baterem.
    return kcal_do_kj, 1.0, False


def _atwater(proteina: Optional[float], carbo: Optional[float], gordura: Optional[float]):
    if proteina is None or carbo is None or gordura is None:
        return None
    return 4 * proteina + 4 * carbo + 9 * gordura


def interpretar_produto(produto: dict, code: str) -> Optional[ProdutoOff]:
    """Do JSON do OFF para `ProdutoOff` (por 1 g ou 1 ml). `None` = sem kcal utilizável."""
    nutrientes = produto.get("nutriments")
    if not isinstance(nutrientes, dict):
        return None
    base_unit = _base_unit(produto)
    embalagem, porcao = _tamanhos(produto, base_unit)

    energia = _energia(nutrientes, porcao)
    if energia is None:
        return None
    kcal_100, fator, kcal_confiavel = energia

    def macro(chave: str) -> Optional[float]:
        bruto = _por_100(nutrientes, chave, porcao)
        if bruto is None:
            return None
        return _macro_por_grama(bruto / fator)

    proteina, carbo, gordura = macro("proteins"), macro("carbohydrates"), macro("fat")
    if not kcal_confiavel:
        # kcal veio do kJ porque o declarado não fechou; macro só vale se fechar com ele.
        atwater = _atwater(proteina, carbo, gordura)
        if atwater is None or not 0.7 <= atwater * 100 / kcal_100 <= 1.3:
            proteina = carbo = gordura = None

    return ProdutoOff(
        nome=_nome_limpo(produto, code),
        base_unit=base_unit,
        kcal=round(kcal_100 / 100, 6),
        proteina=proteina,
        carbo=carbo,
        gordura=gordura,
        embalagem=embalagem,
        porcao=porcao,
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
        portions=diary_foods.porcoes_sugeridas(
            produto.base_unit, produto.embalagem, produto.porcao
        ),
    )


def _chave(code: str) -> str:
    return f"{CHAVE_VERSAO}{code}"


def _reescrever(linha: FoodCache, code: str, produto: ProdutoOff) -> None:
    linha.name = produto.nome
    linha.name_normalized = _chave(code)
    linha.unit_type = produto.base_unit
    linha.calories_per_unit = produto.kcal
    linha.protein_per_base_unit = produto.proteina
    linha.carbs_per_base_unit = produto.carbo
    linha.fat_per_base_unit = produto.gordura
    linha.package_quantity = produto.embalagem
    linha.serving_quantity = produto.porcao


def _gravar(db: Session, user_id: int, code: str, produto: ProdutoOff) -> FoodCache:
    linha = FoodCache(
        source="openfoodfacts",
        created_by_user_id=user_id,
        off_product_id=code,
        name="",
        name_normalized="",
        unit_type="g",
        calories_per_unit=0.0,
    )
    _reescrever(linha, code, produto)
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
    do_mine = buscar_no_mine(db, user_id, code)
    if do_mine is not None:
        return do_mine

    # (2) cache do próprio usuário (só linha da versão atual; a antiga é refeita abaixo)
    linha = _ler_cache(db, user_id, code)
    if linha is not None and linha.name_normalized == _chave(code):
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

    if linha is not None:
        # Linha da versão antiga (valores errados / sem unidade certa): reescreve no lugar.
        _reescrever(linha, code, produto)
        db.commit()
        db.refresh(linha)
        opcao = diary_foods.opcao_do_cache(linha)
        assert opcao is not None, "linha reescrita com unit_type invalido"
        return opcao

    if not diary_foods._pode_gravar_cache(db, user_id):
        return _opcao_efemera(produto)

    linha = _gravar(db, user_id, code, produto)
    opcao = diary_foods.opcao_do_cache(linha)
    assert opcao is not None, "linha recem-gravada com unit_type invalido"
    return opcao
