from app.services.ai import _safe_json_loads, _diet_restrictions_prompt
from app.schemas.profile import ProfileResponse


def _profile(**overrides):
    data = dict(
        id=1,
        user_id=1,
        age=30,
        weight=75.0,
        height=178.0,
        gender="male",
        activity_level="sedentary",
        goal="maintain",
        diet_type="omnivore",
        allergies="",
        food_likes="",
        food_dislikes="",
    )
    data.update(overrides)
    return ProfileResponse(**data)


def test_safe_json_loads_parses_valid_json():
    assert _safe_json_loads('{"a": 1}') == {"a": 1}


def test_safe_json_loads_returns_none_for_empty_or_missing():
    assert _safe_json_loads(None) is None
    assert _safe_json_loads("") is None


def test_safe_json_loads_returns_none_for_malformed_json():
    # Regressão: a IA às vezes devolve texto que não é JSON (explicação, markdown
    # residual) — antes isso estourava json.JSONDecodeError não tratado (500 cru).
    assert _safe_json_loads("Desculpe, não consegui gerar isso.") is None
    assert _safe_json_loads("```json\n{quebrado") is None


def test_diet_restrictions_prompt_includes_diet_label():
    prompt = _diet_restrictions_prompt(_profile(diet_type="vegan"))
    assert "Vegano" in prompt


def test_diet_restrictions_prompt_unknown_diet_type_falls_back_to_omnivore():
    prompt = _diet_restrictions_prompt(_profile(diet_type="algo_nao_mapeado"))
    assert "Onívoro" in prompt


def test_diet_restrictions_prompt_includes_allergies_when_present():
    prompt = _diet_restrictions_prompt(_profile(allergies="amendoim, camarão"))
    assert "amendoim, camarão" in prompt
    assert "Alergias" in prompt


def test_diet_restrictions_prompt_omits_allergies_when_empty():
    prompt = _diet_restrictions_prompt(_profile(allergies=""))
    assert "Alergias" not in prompt


def test_diet_restrictions_prompt_includes_food_dislikes_and_likes():
    prompt = _diet_restrictions_prompt(_profile(food_dislikes="brócolis", food_likes="frango"))
    assert "brócolis" in prompt
    assert "frango" in prompt
