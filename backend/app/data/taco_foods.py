"""
Subconjunto curado da Tabela Brasileira de Composição de Alimentos (TACO/UNICAMP)
com alimentos comuns no dia a dia brasileiro.

⚠️ ATENÇÃO — DADO NUTRICIONAL NÃO CONFERIDO ⚠️
Os macronutrientes (proteína, carboidrato, gordura) deste arquivo foram preenchidos
SEM conferência contra a publicação oficial da TACO/UNICAMP e precisam de revisão
nutricional antes de ir para produção — por isso `TACO_DATASET_VERSION` carrega o
sufixo `UNVERIFIED`, que atravessa o seeder e fica gravado em `food_catalog.dataset_version`.

Regras que valem enquanto essa revisão não acontece:
- **Uma casa decimal**, nunca três: a precisão do número não pode sugerir uma exatidão
  que a origem do dado não tem.
- **Macro desconhecido é `None`, nunca `0.0`** (§ 9.4 do ADR-0001). "0 g de proteína" é
  uma afirmação nutricional; um chute não é. Os itens sem macro publicado com confiança
  razoável (granola, pipoca, Rap10) saem com `None` nos três macros.
- Os valores de **kcal** NÃO foram alterados: são os mesmos que já estavam neste arquivo
  e que `services/ai.py` consome hoje.

TACO_PER_100G: kcal por 100g/100ml do alimento (uso com unidades "g"/"ml").
TACO_PER_UNIT: kcal por 1 unidade "de contagem" (ex: 1 ovo, 1 pão francês).
"""

from dataclasses import dataclass
from typing import Literal

from app.core.normalize import normalize_food_name

# Bump obrigatório a cada alteração de dado — é o que faz `sync_food_catalog()` ressincronizar.
# O sufixo UNVERIFIED é contrato, não enfeite: enquanto ele estiver aqui, o catálogo servido
# em produção declara na própria linha que os macros não foram conferidos na fonte oficial.
TACO_DATASET_VERSION = "taco-subset-2026.08-UNVERIFIED"

BaseUnit = Literal["g", "ml", "un"]


@dataclass(frozen=True, slots=True)
class TacoFood:
    slug: str  # "arroz-branco-cozido-g" (estável, é chave externa via food_ref)
    name: str  # "Arroz branco cozido"   (com acento, é rótulo de tela)
    name_normalized: str  # "arroz branco cozido" (== normalize_food_name(name))
    base_unit: BaseUnit
    # Para base_unit == "un", os quatro campos *_per_100 são POR 1 UNIDADE, não por 100.
    # O sufixo mentiroso é deliberado (§ 4.1 do ADR-0001): um nome mentiroso e documentado
    # é menos perigoso que duas famílias de nome parecidas. O seeder trata a diferença.
    kcal_per_100: float
    # None = macro não conferido/não publicado. NÃO é zero (§ 9.4).
    protein_g_per_100: float | None
    carbs_g_per_100: float | None
    fat_g_per_100: float | None


def _f(
    name: str,
    base_unit: BaseUnit,
    kcal: float,
    protein: float | None,
    carbs: float | None,
    fat: float | None,
) -> TacoFood:
    """Deriva `name_normalized` e `slug` do nome — transcrever os dois à mão 96 vezes é
    uma fonte de erro que nenhum teste pega até o food_ref de alguém parar de resolver."""
    normalized = normalize_food_name(name)
    return TacoFood(
        slug=f"{normalized.replace(' ', '-')}-{base_unit}",
        name=name,
        name_normalized=normalized,
        base_unit=base_unit,
        kcal_per_100=kcal,
        protein_g_per_100=protein,
        carbs_g_per_100=carbs,
        fat_g_per_100=fat,
    )


# A ORDEM importa: TACO_PER_100G e TACO_PER_UNIT são derivados desta tupla, e
# `_best_match` de services/ai.py itera o dict. Manter a ordem original preserva o
# desempate atual entre chaves de mesmo score.
TACO_FOODS: tuple[TacoFood, ...] = (
    # ---- massa/volume: kcal, proteína, carboidrato e gordura por 100 g / 100 ml ----
    _f("Arroz branco cozido", "g", 128, 2.5, 28.1, 0.2),
    _f("Arroz integral cozido", "g", 124, 2.6, 25.8, 1.0),
    _f("Feijão carioca cozido", "g", 76, 4.8, 13.6, 0.5),
    _f("Feijão preto cozido", "g", 77, 4.5, 14.0, 0.5),
    _f("Lentilha cozida", "g", 93, 6.3, 16.3, 0.5),
    _f("Grão de bico cozido", "g", 164, 8.9, 27.4, 2.6),
    _f("Frango peito grelhado", "g", 159, 32.0, 0.0, 2.5),
    _f("Frango peito cozido", "g", 163, 31.5, 0.0, 3.2),
    _f("Frango coxa assada", "g", 215, 26.9, 0.0, 11.8),
    _f("Frango desfiado", "g", 190, 27.0, 0.0, 8.5),
    _f("Carne bovina moída cozida", "g", 212, 26.7, 0.0, 11.4),
    _f("Carne bovina patinho grelhado", "g", 219, 35.9, 0.0, 7.3),
    _f("Carne bovina acém cozido", "g", 219, 27.4, 0.0, 11.8),
    _f("Carne suína lombo assado", "g", 210, 35.7, 0.0, 6.4),
    _f("Peixe tilápia grelhado", "g", 128, 26.0, 0.0, 2.4),
    _f("Peixe salmão grelhado", "g", 208, 23.9, 0.0, 12.0),
    _f("Atum em lata", "g", 128, 26.0, 0.0, 2.8),
    _f("Batata inglesa cozida", "g", 52, 1.2, 11.9, 0.1),
    _f("Batata doce cozida", "g", 77, 0.6, 18.4, 0.1),
    _f("Mandioca cozida", "g", 125, 0.6, 30.1, 0.3),
    _f("Mandioquinha cozida", "g", 80, 1.0, 18.9, 0.2),
    _f("Macarrão cozido", "g", 111, 3.9, 23.1, 0.6),
    _f("Macarrão integral cozido", "g", 124, 5.0, 25.0, 1.0),
    _f("Pão de forma", "g", 253, 8.4, 49.9, 3.0),
    _f("Pão integral", "g", 253, 9.4, 49.9, 3.4),
    _f("Leite integral", "ml", 61, 2.9, 4.7, 3.2),
    _f("Leite desnatado", "ml", 42, 3.4, 4.9, 0.4),
    _f("Leite semidesnatado", "ml", 47, 3.2, 4.8, 1.6),
    _f("Iogurte natural", "g", 51, 4.1, 1.9, 3.0),
    _f("Iogurte grego", "g", 103, 5.0, 9.0, 5.0),
    _f("Queijo minas frescal", "g", 264, 17.4, 3.2, 20.2),
    _f("Queijo mussarela", "g", 330, 25.0, 3.0, 25.0),
    _f("Queijo prato", "g", 360, 25.0, 1.9, 28.0),
    _f("Queijo cottage", "g", 98, 11.0, 3.0, 4.5),
    _f("Requeijão", "g", 257, 9.6, 3.0, 22.5),
    _f("Cream cheese", "g", 320, 6.0, 4.0, 31.0),
    _f("Banana prata", "g", 98, 1.3, 26.0, 0.1),
    _f("Banana nanica", "g", 92, 1.4, 23.8, 0.1),
    _f("Maçã", "g", 56, 0.3, 15.2, 0.0),
    _f("Laranja", "g", 45, 1.0, 11.5, 0.1),
    _f("Mamão", "g", 40, 0.5, 10.4, 0.1),
    _f("Abacaxi", "g", 48, 0.9, 12.3, 0.1),
    _f("Melancia", "g", 33, 0.9, 8.1, 0.0),
    _f("Manga", "g", 64, 0.4, 16.7, 0.2),
    _f("Uva", "g", 53, 0.7, 13.6, 0.2),
    _f("Morango", "g", 30, 0.9, 6.8, 0.3),
    _f("Abacate", "g", 96, 1.2, 6.0, 8.4),
    _f("Tomate", "g", 15, 1.1, 3.1, 0.2),
    _f("Alface", "g", 11, 1.3, 1.7, 0.1),
    _f("Cenoura crua", "g", 34, 1.3, 7.7, 0.2),
    _f("Cenoura cozida", "g", 32, 0.8, 7.1, 0.2),
    _f("Brócolis cozido", "g", 25, 2.1, 4.4, 0.5),
    _f("Couve refogada", "g", 60, 1.7, 5.0, 3.7),
    _f("Espinafre cozido", "g", 21, 2.7, 2.0, 0.3),
    _f("Abobrinha cozida", "g", 20, 1.1, 3.7, 0.2),
    _f("Abóbora cozida", "g", 40, 0.7, 9.3, 0.1),
    _f("Beterraba cozida", "g", 32, 1.3, 7.2, 0.1),
    _f("Cebola crua", "g", 39, 1.7, 8.9, 0.1),
    _f("Alho cru", "g", 113, 7.0, 23.9, 0.2),
    _f("Pepino", "g", 10, 0.9, 2.0, 0.0),
    _f("Ovo cozido", "g", 146, 13.3, 0.6, 9.5),
    _f("Ovo frito", "g", 196, 15.6, 1.2, 13.6),
    _f("Azeite de oliva", "ml", 884, 0.0, 0.0, 100.0),
    _f("Óleo de soja", "ml", 884, 0.0, 0.0, 100.0),
    _f("Manteiga", "g", 726, 0.6, 0.1, 82.4),
    _f("Margarina", "g", 596, 0.3, 0.4, 65.0),
    _f("Açúcar refinado", "g", 387, 0.0, 99.5, 0.0),
    _f("Mel", "g", 309, 0.0, 84.0, 0.0),
    _f("Aveia em flocos", "g", 394, 13.9, 66.6, 8.5),
    # Granola não tem composição estável (cada marca muda castanha, açúcar e óleo):
    # macro aqui seria chute com cara de dado. Fica None até haver rótulo de referência.
    _f("Granola", "g", 471, None, None, None),
    _f("Farinha de trigo", "g", 360, 9.8, 75.1, 1.4),
    _f("Farinha de mandioca", "g", 361, 1.6, 87.9, 0.3),
    _f("Tapioca goma", "g", 240, 0.0, 60.0, 0.0),
    _f("Chocolate ao leite", "g", 540, 7.0, 59.0, 30.0),
    _f("Chocolate amargo", "g", 545, 7.0, 47.0, 35.0),
    _f("Café coado", "ml", 2, 0.1, 0.3, 0.0),
    _f("Suco de laranja", "ml", 45, 0.7, 10.4, 0.1),
    _f("Batata frita", "g", 312, 3.8, 40.0, 15.0),
    # Pipoca varia com o meio de preparo (óleo, manteiga, micro-ondas) numa faixa larga
    # demais para um número único. Sem rótulo de referência, fica None.
    _f("Pipoca", "g", 375, None, None, None),
    _f("Castanha do Pará", "g", 643, 14.5, 12.8, 63.5),
    _f("Amendoim", "g", 544, 27.2, 20.3, 43.9),
    _f("Castanha de caju", "g", 570, 18.5, 29.1, 43.8),
    _f("Quinoa cozida", "g", 120, 4.4, 21.3, 1.9),
    # ---- contagem: os campos *_per_100 são POR 1 UNIDADE ----
    _f("Ovo", "un", 70, 6.3, 0.4, 4.8),
    _f("Pão francês", "un", 135, 4.0, 29.0, 1.5),
    _f("Pão de forma fatia", "un", 65, 2.1, 12.5, 0.8),
    _f("Banana", "un", 90, 1.2, 23.0, 0.1),
    _f("Maçã", "un", 78, 0.4, 19.0, 0.2),
    _f("Tapioca", "un", 130, 0.0, 32.0, 0.0),
    # Rap10 é produto comercial: a composição vem do rótulo do fabricante, que não temos
    # aqui. kcal é o que já estava no arquivo; macro fica None em vez de inventado.
    _f("Rap10", "un", 120, None, None, None),
    _f("Rap 10", "un", 120, None, None, None),
    _f("Torrada", "un", 30, 0.9, 5.6, 0.4),
    _f("Biscoito água e sal", "un", 15, 0.3, 2.5, 0.4),
    _f("Bolacha maisena", "un", 20, 0.3, 3.6, 0.5),
    _f("Fatia de queijo", "un", 60, 4.3, 0.4, 4.5),
    _f("Fatia de presunto", "un", 25, 3.0, 0.3, 1.2),
)

TACO_BY_SLUG: dict[str, TacoFood] = {f.slug: f for f in TACO_FOODS}

# ---------------------------------------------------------------------------
# COMPATIBILIDADE OBRIGATÓRIA — não remover.
# `services/ai.py:126-136` depende dos dois dicts abaixo e fica INTOCADO. São visões
# derivadas de TACO_FOODS e reproduzem exatamente o conteúdo anterior deste arquivo:
# 83 itens em TACO_PER_100G (líquidos incluídos, é para lá que _lookup_taco os manda)
# e 13 em TACO_PER_UNIT.
# ---------------------------------------------------------------------------
TACO_PER_100G: dict[str, float] = {
    f.name_normalized: f.kcal_per_100 for f in TACO_FOODS if f.base_unit in ("g", "ml")
}
TACO_PER_UNIT: dict[str, float] = {
    f.name_normalized: f.kcal_per_100 for f in TACO_FOODS if f.base_unit == "un"
}
