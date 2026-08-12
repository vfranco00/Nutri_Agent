// Define o formato do Perfil (igual ao Pydantic do Back)
export interface Profile {
  id?: number;
  user_id?: number;
  age: number;
  weight: number;
  height: number;
  gender: 'male' | 'female';
  activity_level: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'super_active';
  goal: 'lose_weight' | 'maintain' | 'gain_muscle';
  bmr?: number;
  daily_calories?: number;
  diet_type?: string;
  allergies?: string;
  food_likes?: string;
  food_dislikes?: string;
  eats_fruit?: boolean;
  body_fat_goal?: boolean;
}

export const DIET_TYPES = {
  omnivore: 'Onívoro (Sem restrições)',
  flexitarian: 'Flexitariano (Reduz carne)',
  pescatarian: 'Pescetariano (Peixe sim, carne não)',
  vegetarian_ovo_lacto: 'Vegetariano (Ovo-Lacto)',
  vegetarian_lacto: 'Vegetariano (Lacto)',
  vegetarian_ovo: 'Vegetariano (Ovo)',
  vegan: 'Vegano (Nada animal)',
  paleo: 'Paleolítica',
  keto: 'Cetogênica',
  low_carb: 'Low Carb',
};

// Labels amigáveis para mostrar no select
export const ACTIVITY_LEVELS = {
  sedentary: 'Sedentário (Pouco ou nenhum exercício)',
  lightly_active: 'Levemente Ativo (1-3 dias/semana)',
  moderately_active: 'Moderadamente Ativo (3-5 dias/semana)',
  very_active: 'Muito Ativo (6-7 dias/semana)',
  super_active: 'Super Ativo (Trabalho físico pesado/Treino 2x dia)',
};

export const GOALS = {
  lose_weight: 'Perder Peso',
  maintain: 'Manter Peso',
  gain_muscle: 'Ganhar Massa Muscular',
};

export interface Recipe {
  id: number;
  user_id: number;
  title: string;
  description?: string;
  instructions: string;
  prep_time?: number;
  calories?: number;
  preparation_method?: string;
  category?: string;
  is_favorite?: boolean;
  ingredients?: Ingredient[];
  is_new?: boolean;
  is_ai?: boolean;
}

// Ranking da comunidade (GET /users/leaderboard). Tipo próprio, e não `User`:
// a rota devolve de propósito só o que a tela desenha. Ela já entregou email,
// is_superuser e last_login_at de todo mundo — inclusive sem login — porque
// reaproveitava o schema completo de usuário na resposta.
export interface LeaderboardEntry {
  id: number;
  display_name: string;
  score: number;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  is_superuser: boolean;
  is_active: boolean;
  is_verified?: boolean;
  has_profile?: boolean;
  has_seen_onboarding?: boolean;
  plan?: "starter" | "plus" | "pro";
  score?: number;
  last_login_at?: string | null;
}

export interface Meal {
  name: string;
  suggestion: string;
  category?: string;
}

export interface AiPlan {
  calories_target: number;
  macros: {
    protein: string;
    carbs: string;
    fats: string;
  };
  meals: Meal[];
  tip: string;
}

export interface ShoppingItem {
  id: number;
  name: string;
  checked: boolean;
}

export interface ShoppingList {
  id: number;
  title: string;
  created_at: string;
  items: ShoppingItem[];
}

export interface DailyPlan {
  day: string;
  calories_target: number;
  macros: {
    protein: string;
    carbs: string;
    fats: string;
  };
  meals: Meal[];
  tip: string;
}

export interface AiPlanResponse {
  days: DailyPlan[];
  plan_token: string;
}

export interface Ingredient {
  id?: number;
  name: string;
  quantity: number;
  unit: string;
  calories?: number; // <--- Novo
}

export const CATEGORIES = {
  all: 'Todas',
  cafe_da_manha: 'Café da Manhã',
  almoco: 'Almoço',
  lanche: 'Lanche',
  jantar: 'Jantar',
  ceia: 'Ceia',
  doce: 'Doce',
  salgado: 'Salgado'
};

export const MEAL_SLOTS = ['Café da Manhã', 'Lanche da Manhã', 'Almoço', 'Lanche da Tarde', 'Jantar', 'Ceia'];

export interface MealPlanRecipeSummary {
  id: number;
  title: string;
  calories?: number;
  category?: string;
}

export interface MealPlanMeal {
  id: number;
  meal_plan_day_id: number;
  slot_name: string;
  recipe_id?: number | null;
  custom_title?: string | null;
  custom_description?: string | null;
  calories?: number | null;
  recipe?: MealPlanRecipeSummary | null;
}

export interface MealPlanDay {
  id: number;
  meal_plan_id: number;
  day_label: string;
  day_index: number;
  calories_target?: number | null;
  macros_protein?: string | null;
  macros_carbs?: string | null;
  macros_fats?: string | null;
  meals: MealPlanMeal[];
}

export interface MealPlan {
  id: number;
  user_id: number;
  title: string;
  source: 'ai' | 'manual';
  created_at: string;
  days: MealPlanDay[];
}

// ============================================================================
// DIÁRIO ALIMENTAR — contrato do ADR-0001 (docs/adr/0001-diario-alimentar.md).
// Espelha os schemas Pydantic de backend/app/schemas/diary.py.
// Alterar aqui sem alterar lá (e o ADR) quebra o contrato entre front e back.
// ============================================================================

/** As 6 chaves de slot. Valor de API e de banco — o rótulo fica em MEAL_SLOT_LABELS. */
export type MealSlot =
  | 'cafe_da_manha'
  | 'lanche_manha'
  | 'almoco'
  | 'lanche_tarde'
  | 'jantar'
  | 'ceia';

/** Ordem canônica. DiaryDay.slots já vem nesta ordem — não reordenar no cliente. */
export const MEAL_SLOT_ORDER: readonly MealSlot[] = [
  'cafe_da_manha',
  'lanche_manha',
  'almoco',
  'lanche_tarde',
  'jantar',
  'ceia',
];

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  cafe_da_manha: 'Café da Manhã',
  lanche_manha: 'Lanche da Manhã',
  almoco: 'Almoço',
  lanche_tarde: 'Lanche da Tarde',
  jantar: 'Jantar',
  ceia: 'Ceia',
};

/** As 8 unidades aceitas. O dropdown é montado a partir de FoodOption.allowed_units,
 *  nunca a partir desta lista inteira. */
export type DiaryUnit =
  | 'g'
  | 'ml'
  | 'un'
  | 'colher_sopa'
  | 'colher_cha'
  | 'xicara'
  | 'fatia'
  | 'porcao';

export const DIARY_UNIT_LABELS: Record<DiaryUnit, string> = {
  g: 'g',
  ml: 'ml',
  un: 'unidade',
  colher_sopa: 'colher de sopa',
  colher_cha: 'colher de chá',
  xicara: 'xícara',
  fatia: 'fatia',
  porcao: 'porção',
};

/** Unidade em que o valor nutricional do alimento é expresso: 1 g, 1 ml ou 1 unidade. */
export type FoodBaseUnit = 'g' | 'ml' | 'un';

/** Procedência do dado nutricional. 'taco'/'curated' são curados e compartilhados;
 *  'openfoodfacts'/'llm' são estimativas isoladas por usuário (RS-17). */
export type FoodSource = 'taco' | 'curated' | 'openfoodfacts' | 'llm';

/** Alimento pronto para virar entrada. Mesmo formato na busca e no resolve. */
export interface FoodOption {
  /** 'catalog:<slug>' ou 'cache:<id>'. Opaco — não parsear, só repassar no POST. */
  food_ref: string;
  name: string;
  base_unit: FoodBaseUnit;
  kcal_per_base_unit: number;
  /** null = a fonte não informou o macro. NÃO é zero. */
  protein_per_base_unit: number | null;
  carbs_per_base_unit: number | null;
  fat_per_base_unit: number | null;
  /** Único insumo válido para montar o seletor de unidade deste alimento. */
  allowed_units: DiaryUnit[];
  source: FoodSource;
  /** true => a interface marca como estimativa. Já calculado no servidor. */
  is_estimate: boolean;
}

/** GET /diary/foods/search */
export interface FoodSearchResponse {
  results: FoodOption[];
  /** true apenas quando results está vazio: habilita o botão "Estimar com IA". */
  suggest_resolve: boolean;
}

/** Uma linha do diário. Totais já calculados e arredondados no servidor. */
export interface DiaryEntry {
  id: number;
  /** 'YYYY-MM-DD' */
  entry_date: string;
  meal_slot: MealSlot;
  food_ref: string;
  food_name: string;
  quantity: number;
  unit: DiaryUnit;
  base_unit: FoodBaseUnit;
  calories_total: number;
  /** null = macro desconhecido para este alimento. Não renderizar como 0. */
  protein_g_total: number | null;
  carbs_g_total: number | null;
  fat_g_total: number | null;
  source: FoodSource;
  is_estimate: boolean;
  /** ISO 8601 sem timezone (UTC) */
  created_at: string;
  updated_at: string;
}

/** Bloco de totais. `calories` sempre número; macros podem ser null. */
export interface DiaryTotals {
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

/** Refeição do CARDÁPIO (planejado) projetada no dia. Não é DiaryEntry. */
export interface DiaryPlannedMeal {
  /** id de meal_plan_meals */
  id: number;
  title: string;
  calories: number | null;
  recipe_id: number | null;
}

/** Um dos 6 slots. Sempre presente, mesmo vazio. */
export interface DiaryDaySlot {
  slot: MealSlot;
  label: string;
  /** Parte SÓLIDA da barra segmentada. */
  logged_calories: number;
  /** Parte HACHURADA da barra segmentada. 0 quando não há plano — nunca null. */
  planned_calories: number;
  entries: DiaryEntry[];
  planned_meals: DiaryPlannedMeal[];
}

/** Cardápio vigente na data, resolvido via diary_plan_bindings. */
export interface DiaryBoundPlan {
  binding_id: number;
  meal_plan_id: number;
  title: string;
  day_label: string;
  day_index: number;
}

/** GET /diary?date= e resposta de TODA mutação (POST/PATCH/DELETE).
 *  O frontend nunca soma nada: usa totals/logged_calories como vêm. */
export interface DiaryDay {
  /** 'YYYY-MM-DD' */
  date: string;
  /** Meta do perfil (profiles.daily_calories). null = perfil sem meta definida. */
  calories_target: number | null;
  totals: DiaryTotals;
  planned_totals: DiaryTotals;
  /** Calorias planejadas cujo slot não foi reconhecido. Já inclusas em planned_totals. */
  planned_unmatched_calories: number;
  entries_count: number;
  has_estimate: boolean;
  /** true => algum macro do dia é desconhecido; não apresentar totals de macro como fechado. */
  macros_incomplete: boolean;
  meal_plan: DiaryBoundPlan | null;
  /** SEMPRE 6 itens, sempre em MEAL_SLOT_ORDER. */
  slots: DiaryDaySlot[];
}

/** GET /diary/summary */
export interface DiaryDaySummary {
  date: string;
  calories: number;
  planned_calories: number;
  entries_count: number;
}

export interface DiarySummaryResponse {
  /** Todas as datas do intervalo, inclusive as sem registro. */
  days: DiaryDaySummary[];
  calories_target: number | null;
}

/** Corpo do POST /diary. Sem food_name, sem calories_total, sem user_id:
 *  o backend recusa campo extra com 422 (extra="forbid"). */
export interface DiaryEntryCreate {
  entry_date: string;
  meal_slot: MealSlot;
  food_ref: string;
  quantity: number;
  unit: DiaryUnit;
}

/** Corpo do PATCH /diary/{id}. Pelo menos um campo. food_ref NÃO é editável. */
export interface DiaryEntryUpdate {
  entry_date?: string;
  meal_slot?: MealSlot;
  quantity?: number;
  unit?: DiaryUnit;
}

/** POST /diary/foods/resolve */
export interface FoodResolveRequest {
  name: string;
  unit: DiaryUnit;
}

export interface DiaryPlanBinding {
  id: number;
  meal_plan_id: number;
  start_date: string;
  end_date: string | null;
  created_at: string;
}

export interface DiaryPlanBindingCreate {
  meal_plan_id: number;
  start_date: string;
  end_date?: string | null;
}

/** Erro de negócio: axios error.response.data.detail quando NÃO é array. */
export interface DiaryApiError {
  code:
    | 'FOOD_NOT_FOUND'
    | 'FOOD_NOT_RESOLVED'
    | 'FOOD_RESOLVER_UNAVAILABLE'
    | 'ENTRY_NOT_FOUND'
    | 'MEAL_PLAN_NOT_FOUND'
    | 'BINDING_NOT_FOUND'
    | 'PLAN_LIMIT_REACHED'
    | 'UNIT_NOT_SUPPORTED_FOR_FOOD';
  message: string;
  /** Presentes apenas em PLAN_LIMIT_REACHED (formato de quotas.py). */
  event_type?: string;
  limit?: number;
  used?: number;
}

/** O 422 devolve `detail` como ARRAY (handler do RS-12) e sem o campo `input`.
 *  Use este type guard antes de ler `detail.code`. */
export function isDiaryApiError(detail: unknown): detail is DiaryApiError {
  return typeof detail === 'object' && detail !== null && !Array.isArray(detail)
    && 'code' in (detail as Record<string, unknown>);
}