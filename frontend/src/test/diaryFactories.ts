import {
  MEAL_SLOT_LABELS,
  MEAL_SLOT_ORDER,
  type DiaryDay,
  type DiaryDaySlot,
  type DiaryEntry,
  type FoodOption,
  type MealSlot,
} from "../types";

/**
 * Fábricas do `DiaryDay` para os testes.
 *
 * `makeDay` sempre devolve os **6 slots, na ordem canônica**, mesmo vazios —
 * é a garantia de contrato do § 6.0 do ADR-0001. Fixar isso na fábrica evita
 * que um teste passe com um payload que o backend nunca produziria.
 */

export function makeEntry(over: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    id: 1,
    entry_date: "2026-08-11",
    meal_slot: "cafe_da_manha",
    food_ref: "catalog:ovo-cozido-g",
    food_name: "Ovo cozido",
    quantity: 100,
    unit: "g",
    base_unit: "g",
    calories_total: 146,
    protein_g_total: 13.3,
    carbs_g_total: 0.6,
    fat_g_total: 9.5,
    source: "taco",
    is_estimate: false,
    created_at: "2026-08-11T09:12:04",
    updated_at: "2026-08-11T09:12:04",
    ...over,
  };
}

export function makeSlot(slot: MealSlot, over: Partial<DiaryDaySlot> = {}): DiaryDaySlot {
  return {
    slot,
    label: MEAL_SLOT_LABELS[slot],
    logged_calories: 0,
    planned_calories: 0,
    entries: [],
    planned_meals: [],
    ...over,
  };
}

export function makeDay(over: Partial<DiaryDay> = {}): DiaryDay {
  const base: DiaryDay = {
    date: "2026-08-11",
    calories_target: 2000,
    totals: { calories: 0, protein_g: null, carbs_g: null, fat_g: null },
    planned_totals: { calories: 0, protein_g: null, carbs_g: null, fat_g: null },
    planned_unmatched_calories: 0,
    entries_count: 0,
    has_estimate: false,
    macros_incomplete: false,
    meal_plan: null,
    slots: MEAL_SLOT_ORDER.map((s) => makeSlot(s)),
    ...over,
  };
  return base;
}

/** Monta um dia a partir de um mapa parcial de slots, preservando os 6. */
export function makeDayWithSlots(
  porSlot: Partial<Record<MealSlot, Partial<DiaryDaySlot>>>,
  over: Partial<DiaryDay> = {},
): DiaryDay {
  return makeDay({
    slots: MEAL_SLOT_ORDER.map((s) => makeSlot(s, porSlot[s] ?? {})),
    ...over,
  });
}

export function makeFood(over: Partial<FoodOption> = {}): FoodOption {
  return {
    food_ref: "catalog:arroz-branco-cozido-g",
    name: "Arroz branco cozido",
    base_unit: "g",
    kcal_per_base_unit: 1.28,
    protein_per_base_unit: 0.025,
    carbs_per_base_unit: 0.281,
    fat_per_base_unit: 0.002,
    allowed_units: ["g", "colher_sopa", "colher_cha", "xicara"],
    source: "taco",
    is_estimate: false,
    ...over,
  };
}
