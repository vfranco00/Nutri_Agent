"""Fábricas compartilhadas pelos testes do diário alimentar.

Módulo comum e não `conftest.py` de propósito: o `conftest.py` é lido por toda a suíte
(21 arquivos, 235 testes que não têm nada a ver com o diário) e cada fixture nova ali é
uma superfície nova de acoplamento. Aqui, quem não importa não paga.

O catálogo NÃO é semeado automaticamente: `sync_food_catalog` roda no `lifespan` do
`main.py`, e o `TestClient(app)` do conftest não é usado como context manager — ou seja,
o lifespan nunca executa e `food_catalog` começa VAZIA em todo teste. Quem precisa de
alimento chama `semear_catalogo` ou `alimento_customizado` explicitamente. Isso é
proposital: um catálogo que aparece sozinho esconderia o dia em que a busca passasse a
depender de um seed implícito.
"""

from datetime import datetime, timezone

from app.data.seed_food_catalog import sync_food_catalog
from app.models.diary import DiaryEntry
from app.models.food_cache import FoodCache
from app.models.food_catalog import FoodCatalog
from app.models.meal_plan import MealPlan, MealPlanDay, MealPlanMeal
from app.models.profile import Profile
from app.models.user import User

# Slugs reais do dataset da TACO, com os números que o § 9.3 do ADR-0001 usa como
# exemplos verificáveis. Ficam aqui como constante para que um teste que quebre aponte
# para a mudança de dado, e não para uma string solta no meio de uma asserção.
ARROZ = "catalog:arroz-branco-cozido-g"  # 128 kcal/100 g -> 1.28 por grama
AZEITE = "catalog:azeite-de-oliva-ml"  # 884 kcal/100 ml -> 8.84 por ml
LEITE = "catalog:leite-integral-ml"  # 61 kcal/100 ml -> 0.61 por ml
OVO = "catalog:ovo-un"  # 70 kcal por unidade
GRANOLA = "catalog:granola-g"  # macros None: item sem macro publicado


def hoje():
    """A janela do RS-09 é medida em UTC no servidor — o teste tem que usar a mesma base.

    `date.today()` usa o fuso da máquina: numa máquina em UTC-3 às 22h, ele devolve o dia
    anterior e um teste de "data de amanhã é aceita" passaria a testar "hoje é aceito".
    """
    return datetime.now(timezone.utc).date()


def semear_catalogo(db):
    """Popula `food_catalog` com o dataset real da TACO (96 itens)."""
    sync_food_catalog(db)


def alimento_customizado(
    db,
    *,
    slug="alimento-teste-g",
    name="Alimento teste",
    name_normalized=None,
    base_unit="g",
    kcal=1.0,
    protein=None,
    carbs=None,
    fat=None,
    dataset_version="teste",
):
    """Linha de catálogo com números escolhidos pelo teste.

    Necessária para os casos de arredondamento: o dado real da TACO não tem um valor que
    distinga "somar cru e arredondar no fim" de "somar valores já arredondados", e é
    exatamente essa distinção que o § 9.3 fixa.
    """
    linha = FoodCatalog(
        slug=slug,
        name=name,
        name_normalized=name_normalized if name_normalized is not None else name.lower(),
        base_unit=base_unit,
        kcal_per_base_unit=kcal,
        protein_per_base_unit=protein,
        carbs_per_base_unit=carbs,
        fat_per_base_unit=fat,
        dataset_version=dataset_version,
    )
    db.add(linha)
    db.commit()
    db.refresh(linha)
    return linha


def usuario(db, email):
    """O `make_user` do conftest devolve um client autenticado, não o usuário."""
    db.expire_all()
    return db.query(User).filter(User.email == email).first()


def criar(cli, *, food_ref=ARROZ, quantity=100, unit="g", slot="almoco", data=None):
    """POST /diary com o corpo mínimo do § 6.3."""
    return cli.post(
        "/diary",
        json={
            "entry_date": (data or hoje()).isoformat(),
            "meal_slot": slot,
            "food_ref": food_ref,
            "quantity": quantity,
            "unit": unit,
        },
    )


def entrada_bruta(db, user_id, *, data=None, slot="almoco", kcal=10.0, quantity=1.0):
    """Insere uma linha direto no banco, sem passar pela rota.

    Existe só para montar volume (o teto de 60 do RS-11): 60 POSTs seriam 60 round-trips
    para testar uma condição que não depende de nenhum deles. Qualquer teste sobre o
    COMPORTAMENTO da criação usa `criar`, nunca esta função.
    """
    linha = DiaryEntry(
        user_id=user_id,
        entry_date=data or hoje(),
        meal_slot=slot,
        food_ref=ARROZ,
        food_name="Arroz branco cozido",
        source="taco",
        base_unit="g",
        quantity=quantity,
        unit="g",
        kcal_per_base_unit=1.28,
        calories_total=kcal,
    )
    db.add(linha)
    db.commit()
    return linha


def entradas(dia):
    """Achata as entradas dos 6 slots na ordem em que a resposta as apresenta."""
    return [entrada for slot in dia["slots"] for entrada in slot["entries"]]


def id_da_unica_entrada(dia):
    lista = entradas(dia)
    assert len(lista) == 1, f"esperava 1 entrada, veio {len(lista)}"
    return lista[0]["id"]


def id_mais_recente(dia):
    """A mutação devolve o dia inteiro, não a entrada criada — o id mais alto é o dela."""
    return max(e["id"] for e in entradas(dia))


def perfil(db, user_id, *, daily_calories=2100.0):
    """`calories_target` do dia sai de `profiles.daily_calories`, e de nenhum outro lugar
    (§ 6.4) — em particular, NÃO de `MealPlanDay.calories_target`, que é a meta do
    cardápio e não a do usuário."""
    linha = Profile(
        user_id=user_id,
        age=30,
        weight=70.0,
        height=175.0,
        gender="H",
        activity_level="moderate",
        goal="maintain",
        daily_calories=daily_calories,
    )
    db.add(linha)
    db.commit()
    return linha


def cache_privado(db, user_id, *, name="shake proteico", kcal=4.0, unit_type="g", source="llm"):
    """Linha de `food_cache` isolada por dono (RS-17). É a origem de `is_estimate`."""
    linha = FoodCache(
        name=name,
        name_normalized=name,
        calories_per_unit=kcal,
        unit_type=unit_type,
        source=source,
        created_by_user_id=user_id,
    )
    db.add(linha)
    db.commit()
    db.refresh(linha)
    return linha


def cardapio(db, user_id, *, title="Semana de corte", dias=None):
    """Cardápio com dias e refeições. `dias` é uma lista de listas de (slot_name, kcal).

    O cardápio é entidade separada do diário e NUNCA o referencia (§ 3.2): estes objetos
    existem só para o cruzamento que acontece na LEITURA, por data e por slot.
    """
    dias = dias if dias is not None else [[("Almoço", 600.0)]]
    plano = MealPlan(user_id=user_id, title=title, source="manual")
    db.add(plano)
    db.flush()
    for indice, refeicoes in enumerate(dias):
        dia = MealPlanDay(
            meal_plan_id=plano.id, day_label=f"Dia {indice + 1}", day_index=indice
        )
        db.add(dia)
        db.flush()
        for slot_name, kcal in refeicoes:
            db.add(
                MealPlanMeal(
                    meal_plan_day_id=dia.id,
                    slot_name=slot_name,
                    custom_title=f"{slot_name} do dia {indice + 1}",
                    calories=kcal,
                )
            )
    db.commit()
    db.refresh(plano)
    return plano
