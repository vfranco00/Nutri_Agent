def _profile_payload(**overrides):
    payload = {
        "age": 30,
        "weight": 80.0,
        "height": 180.0,
        "gender": "male",
        "activity_level": "sedentary",
        "goal": "lose_weight",
    }
    payload.update(overrides)
    return payload


def test_get_profile_404_when_none_exists(make_user):
    auth_client = make_user(email="semperfil@example.com")
    res = auth_client.get("/profiles/me")
    assert res.status_code == 404


def test_create_profile_calculates_bmr(make_user):
    auth_client = make_user(email="comperfil@example.com")
    res = auth_client.put("/profiles/me", json=_profile_payload())
    assert res.status_code == 200
    data = res.json()
    assert data["bmr"] is not None
    assert data["daily_calories"] is not None


def test_profile_rejects_numeric_only_allergies(make_user):
    # Regressão: validação de texto livre em Profile.
    auth_client = make_user(email="numerica@example.com")
    res = auth_client.put("/profiles/me", json=_profile_payload(allergies="123"))
    assert res.status_code == 422


def test_profile_accepts_real_text_allergies(make_user):
    auth_client = make_user(email="textoreal@example.com")
    res = auth_client.put("/profiles/me", json=_profile_payload(allergies="Lactose, Glúten"))
    assert res.status_code == 200


def test_profile_accepts_empty_allergies(make_user):
    auth_client = make_user(email="semalergia@example.com")
    res = auth_client.put("/profiles/me", json=_profile_payload(allergies=""))
    assert res.status_code == 200


def test_weight_tracking_and_history(make_user):
    auth_client = make_user(email="peso@example.com")
    auth_client.put("/profiles/me", json=_profile_payload())

    res = auth_client.post("/profiles/weight", json={"weight": 78.5})
    assert res.status_code == 200

    res_history = auth_client.get("/profiles/weight/history")
    assert res_history.status_code == 200
    assert len(res_history.json()) == 1
    assert res_history.json()[0]["weight"] == 78.5
