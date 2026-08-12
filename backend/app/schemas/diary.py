"""Schemas do diário alimentar — contrato do ADR-0001 (§ 6 e § 7).

Espelham `frontend/src/types.ts`. Alterar aqui sem alterar lá (e o ADR) quebra o
contrato entre front e back, que dois agentes implementam em paralelo sem se falar.

Todo schema de ESCRITA declara `extra="forbid"` (RS-02). Não é preciosismo: sem ele,
`{"user_id": 42, ...}` é aceito, ignorado, e continua sendo aceito e ignorado até o dia
em que alguém trocar a construção do model por `DiaryEntry(**payload)` — e aí vira
escrita na conta alheia sem que nenhum teste tenha mudado.
"""

import re
from datetime import date, datetime, timedelta, timezone
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

MealSlotType = Literal[
    "cafe_da_manha", "lanche_manha", "almoco", "lanche_tarde", "jantar", "ceia"
]
DiaryUnitType = Literal[
    "g", "ml", "un", "colher_sopa", "colher_cha", "xicara", "fatia", "porcao"
]
FoodBaseUnitType = Literal["g", "ml", "un"]
FoodSourceType = Literal["taco", "curated", "openfoodfacts", "llm"]

# Ao menos uma letra (com acento) — mesmo validador de schemas/profile.py:33-38.
_HAS_LETTER_RE = re.compile(r"[a-zA-ZÀ-ÖØ-öø-ÿ]")
# Nome de alimento nunca precisa de \n, \r ou byte de controle. Quem os coloca ali está
# construindo uma quebra de linha dentro do prompt do LLM ou uma linha falsa dentro do
# log (log injection). Custa uma regex e fecha os dois (RS-08).
_NOME_PROIBIDO = re.compile(r"[\x00-\x1f\x7f]")

# "catalog:<slug>" ou "cache:<id>". Opaco para o cliente: obtido da busca ou do resolve
# e devolvido inalterado. O formato é validado aqui para que a resolução no router não
# precise confiar em nada do que veio no corpo.
_FOOD_REF_RE = re.compile(r"^(catalog:[a-z0-9-]{1,160}|cache:[0-9]{1,12})$")

JANELA_FUTURO_DIAS = 1
JANELA_PASSADO_DIAS = 730


def _validar_janela_data(v: date) -> date:
    """RS-09.

    +1 dia de folga e não `<= hoje`: o servidor roda em UTC e um usuário em UTC+13 tem
    "hoje" um dia à frente por várias horas — `<= hoje` rejeitaria o café da manhã dele.
    A folga é de exatamente um dia: suficiente para o fuso, insuficiente para "planejar"
    o diário, que é o que a feature de cardápio já faz.

    O piso existe porque, sem ele, `entry_date` é um espaço de escrita de ~4 dígitos de
    ano: cada data distinta é uma linha nova que passa pelo teto de "entradas por dia".
    """
    hoje = datetime.now(timezone.utc).date()
    if v > hoje + timedelta(days=JANELA_FUTURO_DIAS):
        raise ValueError("Não é possível registrar refeição no futuro.")
    if v < hoje - timedelta(days=JANELA_PASSADO_DIAS):
        raise ValueError("Data muito antiga para registro.")
    return v


def _validar_nome_alimento(v: str) -> str:
    v = v.strip()
    if not _HAS_LETTER_RE.search(v):
        raise ValueError("Informe o nome do alimento.")
    if _NOME_PROIBIDO.search(v):
        raise ValueError("Nome de alimento inválido.")
    return v


# --------------------------------------------------------------------------------------
# Alimento (busca e resolve)
# --------------------------------------------------------------------------------------


class FoodOption(BaseModel):
    """Alimento pronto para virar entrada. MESMO formato na busca e no resolve."""

    food_ref: str
    name: str
    base_unit: FoodBaseUnitType
    kcal_per_base_unit: float
    # None = a fonte não informou o macro. NÃO é zero.
    protein_per_base_unit: Optional[float] = None
    carbs_per_base_unit: Optional[float] = None
    fat_per_base_unit: Optional[float] = None
    # Único insumo válido para montar o seletor de unidade deste alimento.
    allowed_units: list[DiaryUnitType]
    source: FoodSourceType
    # Já calculado no servidor: is_estimate = source in ("llm", "openfoodfacts").
    is_estimate: bool


class FoodSearchResponse(BaseModel):
    results: list[FoodOption]
    # true se e somente se `results` está vazio (RS-16). É o gatilho do botão
    # "Estimar com IA" — a busca NUNCA chama o LLM sozinha.
    suggest_resolve: bool


class FoodResolveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    unit: DiaryUnitType

    @field_validator("name")
    @classmethod
    def nome_plausivel(cls, v: str) -> str:
        return _validar_nome_alimento(v)


# --------------------------------------------------------------------------------------
# Entradas
# --------------------------------------------------------------------------------------


class DiaryEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entry_date: date
    meal_slot: MealSlotType
    food_ref: str
    food_name: str
    quantity: float
    unit: DiaryUnitType
    base_unit: FoodBaseUnitType
    calories_total: float
    # None = macro desconhecido para este alimento. A interface renderiza "—", nunca 0.
    protein_g_total: Optional[float] = None
    carbs_g_total: Optional[float] = None
    fat_g_total: Optional[float] = None
    source: FoodSourceType
    is_estimate: bool
    created_at: datetime
    updated_at: datetime


class DiaryEntryCreate(BaseModel):
    # `calories_total`, `food_name` e `user_id` produzem 422 aqui (RS-02, RS-10, Δ1).
    model_config = ConfigDict(extra="forbid")

    entry_date: date
    meal_slot: MealSlotType
    food_ref: str = Field(max_length=180)
    # gt=0 e não ge=0: 0 g de um alimento não é registro, é ruído que polui o total e o
    # gráfico. `le` também é o que impede 1e9 de virar linha no banco (RS-07).
    quantity: float = Field(gt=0, le=10_000)
    unit: DiaryUnitType

    @field_validator("entry_date")
    @classmethod
    def data_na_janela(cls, v: date) -> date:
        return _validar_janela_data(v)

    @field_validator("food_ref")
    @classmethod
    def formato_do_ref(cls, v: str) -> str:
        if not _FOOD_REF_RE.match(v):
            raise ValueError("Referência de alimento inválida.")
        return v


class DiaryEntryUpdate(BaseModel):
    """Corpo parcial. `food_ref` NÃO é editável: trocar o alimento é apagar e criar.

    Isso mantém o recálculo fechado dentro da linha (a entrada guarda snapshot dos
    valores por unidade base) e evita reintroduzir uma resolução — e portanto uma
    possível chamada externa — na rota de edição.
    """

    model_config = ConfigDict(extra="forbid")

    entry_date: Optional[date] = None
    meal_slot: Optional[MealSlotType] = None
    quantity: Optional[float] = Field(default=None, gt=0, le=10_000)
    unit: Optional[DiaryUnitType] = None

    @field_validator("entry_date")
    @classmethod
    def data_na_janela(cls, v: Optional[date]) -> Optional[date]:
        return v if v is None else _validar_janela_data(v)

    @model_validator(mode="after")
    def pelo_menos_um_campo(self) -> "DiaryEntryUpdate":
        # `model_fields_set` responde "o cliente MENCIONOU o campo?", não "mandou valor?".
        # `{"quantity": null}` marca `quantity` como informado, passava por aqui, e o
        # PATCH devolvia 200 tendo atualizado exatamente nada — com a tela anunciando
        # "Registro atualizado." para uma operação que não aconteceu.
        #
        # Nenhum campo deste schema pode ser LIMPO: uma entrada sempre tem data, slot,
        # quantidade e unidade. Portanto `None` aqui só pode significar "não informado".
        informados = [
            nome for nome in self.model_fields_set if getattr(self, nome, None) is not None
        ]
        if not informados:
            raise ValueError("Informe ao menos um campo para atualizar.")
        return self


# --------------------------------------------------------------------------------------
# O dia composto
# --------------------------------------------------------------------------------------


class DiaryTotals(BaseModel):
    calories: float
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None


class DiaryPlannedMeal(BaseModel):
    """Refeição do CARDÁPIO (planejado) projetada no dia. Não é uma entrada de diário."""

    id: int
    title: str
    calories: Optional[float] = None
    recipe_id: Optional[int] = None


class DiaryDaySlot(BaseModel):
    slot: MealSlotType
    label: str
    logged_calories: float  # parte SÓLIDA da barra segmentada
    planned_calories: float  # parte HACHURADA; 0.0 quando não há plano, nunca null
    entries: list[DiaryEntryResponse]
    planned_meals: list[DiaryPlannedMeal]


class DiaryBoundPlan(BaseModel):
    binding_id: int
    meal_plan_id: int
    title: str
    day_label: str
    day_index: int


class DiaryDay(BaseModel):
    """Resposta de GET /diary?date= e de TODA mutação (POST/PATCH/DELETE).

    Um dono da aritmética, zero refetch, zero soma no cliente.
    """

    date: date
    calories_target: Optional[float] = None
    totals: DiaryTotals
    planned_totals: DiaryTotals
    # Calorias planejadas cujo slot_name não foi reconhecido. JÁ inclusas em
    # planned_totals.calories; existem para a interface poder mostrar a nota de rodapé.
    planned_unmatched_calories: float
    entries_count: int
    has_estimate: bool
    # true => algum macro do dia é desconhecido. A interface não pode apresentar
    # totals.protein_g como fato fechado.
    macros_incomplete: bool
    meal_plan: Optional[DiaryBoundPlan] = None
    # SEMPRE 6 itens, SEMPRE em MEAL_SLOT_ORDER.
    slots: list[DiaryDaySlot]


class DiaryDaySummary(BaseModel):
    date: date
    calories: float
    planned_calories: float
    entries_count: int


class DiarySummaryResponse(BaseModel):
    # Todas as datas do intervalo, inclusive as sem registro — o frontend não preenche
    # buraco de calendário.
    days: list[DiaryDaySummary]
    # Fora do array porque é do usuário, não do dia.
    calories_target: Optional[float] = None


# --------------------------------------------------------------------------------------
# Vínculo com o cardápio
# --------------------------------------------------------------------------------------


class DiaryPlanBindingCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    meal_plan_id: int = Field(gt=0)
    start_date: date
    end_date: Optional[date] = None

    @model_validator(mode="after")
    def fim_depois_do_inicio(self) -> "DiaryPlanBindingCreate":
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("A data final não pode ser anterior à inicial.")
        return self


class DiaryPlanBindingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    meal_plan_id: int
    start_date: date
    end_date: Optional[date] = None
    created_at: datetime
