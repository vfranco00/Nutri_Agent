from app.services.ai import _lookup_taco, _normalize, _best_match


def test_normalize_strips_accents_and_lowercases():
    assert _normalize("Pão Francês") == "pao frances"
    assert _normalize("  Arroz  ") == "arroz"


def test_lookup_taco_exact_match_per_100g():
    kcal = _lookup_taco("Arroz Branco Cozido", "g")
    assert kcal == 1.28  # 128 kcal/100g -> 1.28 kcal/g


def test_lookup_taco_word_match_prefers_most_specific():
    # "frango grelhado" não é uma chave exata, mas bate por palavras com
    # "frango peito grelhado" (todas as palavras da query estão na chave).
    kcal = _lookup_taco("Frango grelhado", "g")
    assert kcal == round(159 / 100, 2)


def test_lookup_taco_per_unit_food():
    assert _lookup_taco("pão francês", "un") == 135
    assert _lookup_taco("Rap10", "un") == 120


def test_lookup_taco_unknown_food_returns_none():
    assert _lookup_taco("produto totalmente desconhecido xyz", "g") is None


def test_lookup_taco_unit_mismatch_falls_through():
    # "pão francês" só existe na tabela per-unit ("un"), não faz sentido em "g"
    assert _lookup_taco("pão francês", "g") is None


def test_best_match_empty_dataset_returns_none():
    assert _best_match("qualquer coisa", {}) is None
