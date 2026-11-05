import { api } from "./api";
import { extractDiaryErrorMessage } from "./diary";
import type { Refeicao } from "../routes";
import type {
  DiaryBatchRequest,
  DiaryCopyRequest,
  DiaryDay,
  DiaryEntry,
  DiaryUnit,
  FoodOption,
  MealSlot,
  QuickFood,
  Recipe,
  SavedMeal,
  UserFood,
  UserFoodCreate,
  UserFoodUpdate,
} from "../types";

/** As 4 refeições da folha (protótipo) viram os slots da API. */
export const SLOT_DA_REFEICAO: Record<Refeicao, MealSlot> = {
  cafe: "cafe_da_manha",
  almoco: "almoco",
  lanche: "lanche_tarde",
  jantar: "jantar",
};

export const NOME_DA_REFEICAO: Record<Refeicao, string> = {
  cafe: "Café",
  almoco: "Almoço",
  lanche: "Lanche",
  jantar: "Jantar",
};

export const REFEICOES: readonly Refeicao[] = ["cafe", "almoco", "lanche", "jantar"];

export function ehRefeicao(v: string | null): v is Refeicao {
  return v === "cafe" || v === "almoco" || v === "lanche" || v === "jantar";
}

/** Slot de qualquer refeição: o mapa vale para as 4 da folha; os outros 2 slots ficam como estão. */
export function refeicaoDoSlot(slot: MealSlot): Refeicao {
  if (slot === "cafe_da_manha" || slot === "lanche_manha") return "cafe";
  if (slot === "almoco") return "almoco";
  if (slot === "lanche_tarde") return "lanche";
  return "jantar";
}

/** Evento que avisa as telas de fundo (Hoje, Diário) que o dia mudou. Leva o DiaryDay pronto (D-6). */
export const EVENTO_DIARIO = "nuvi:diario";

export function anunciarDia(day: DiaryDay): void {
  window.dispatchEvent(new CustomEvent<DiaryDay>(EVENTO_DIARIO, { detail: day }));
}

/** Mesmos fatores do servidor (`diary_math.UNIT_FACTOR`). Só para a PRÉVIA da folha de
 *  porção e do carrinho: o que fica no diário é sempre o número que o servidor devolve. */
const FATOR_DA_UNIDADE: Record<DiaryUnit, number> = {
  g: 1, ml: 1, colher_sopa: 15, colher_cha: 5, xicara: 240, un: 1, fatia: 1, porcao: 1,
};

export interface Previa {
  kcal: number;
  p: number | null;
  c: number | null;
  g: number | null;
}

/** Prévia de `quantity unit` do alimento. `null` de macro continua `null` (desconhecido, não zero). */
export function previa(food: FoodOption, quantity: number, unit: DiaryUnit): Previa {
  const k = quantity * FATOR_DA_UNIDADE[unit];
  const mul = (v: number | null) => (v === null ? null : v * k);
  return {
    kcal: food.kcal_per_base_unit * k,
    p: mul(food.protein_per_base_unit),
    c: mul(food.carbs_per_base_unit),
    g: mul(food.fat_per_base_unit),
  };
}

/** Quantidade e unidade ao tocar no "+" de uma linha: 100 g/ml para massa/volume, 1 porção para o resto. */
export function padraoDoMais(food: FoodOption): { quantity: number; unit: DiaryUnit } {
  if (food.base_unit === "g" || food.base_unit === "ml") return { quantity: 100, unit: food.base_unit };
  const unit: DiaryUnit = food.allowed_units.includes("porcao") ? "porcao" : (food.allowed_units[0] ?? "un");
  return { quantity: 1, unit };
}

/** Os ids criados por um lote: as `n` maiores ids do slot no dia devolvido (o lote é atômico). */
export function idsNovosDoLote(day: DiaryDay, slot: MealSlot, n: number): number[] {
  const ids = (day.slots.find((s) => s.slot === slot)?.entries ?? []).map((e) => e.id).sort((a, b) => b - a);
  return ids.slice(0, n);
}

export function opcaoDoMeu(f: UserFood): FoodOption {
  return {
    food_ref: f.food_ref,
    name: f.name,
    base_unit: "un",
    kcal_per_base_unit: f.kcal,
    protein_per_base_unit: f.protein_g,
    carbs_per_base_unit: f.carbs_g,
    fat_per_base_unit: f.fat_g,
    allowed_units: ["un", "fatia", "porcao"],
    source: "user",
    is_estimate: false,
    portion_label: f.portion_label,
  };
}

/** Receita como alimento: uma porção. `null` quando não há kcal (o servidor também recusa). */
export function opcaoDaReceita(r: Recipe): FoodOption | null {
  const soma = (r.ingredients ?? []).reduce((a, i) => a + (i.calories ?? 0), 0);
  const kcal = r.calories ?? (soma > 0 ? soma : null);
  if (kcal === null || kcal <= 0) return null;
  return {
    food_ref: `recipe:${r.id}`,
    name: r.title,
    base_unit: "un",
    kcal_per_base_unit: kcal,
    protein_per_base_unit: null,
    carbs_per_base_unit: null,
    fat_per_base_unit: null,
    allowed_units: ["un", "fatia", "porcao"],
    source: "recipe",
    is_estimate: false,
    portion_label: "porção",
  };
}

export async function listarRecentes(limit = 20): Promise<QuickFood[]> {
  const r = await api.get<{ items: QuickFood[] }>("/diary/foods/recent", { params: { limit } });
  return r.data.items;
}

export async function listarFrequentes(limit = 20): Promise<QuickFood[]> {
  const r = await api.get<{ items: QuickFood[] }>("/diary/foods/frequent", { params: { limit } });
  return r.data.items;
}

export async function listarMeus(): Promise<UserFood[]> {
  const r = await api.get<{ items: UserFood[] }>("/diary/foods/mine");
  return r.data.items;
}

export async function buscarMeuPorCodigo(barcode: string): Promise<UserFood | null> {
  const r = await api.get<{ items: UserFood[] }>("/diary/foods/mine", { params: { barcode } });
  return r.data.items[0] ?? null;
}

export async function obterMeu(id: number | string): Promise<UserFood> {
  return (await api.get<UserFood>(`/diary/foods/mine/${id}`)).data;
}

export async function criarMeu(body: UserFoodCreate): Promise<UserFood> {
  return (await api.post<UserFood>("/diary/foods/mine", body)).data;
}

export async function editarMeu(id: number | string, body: UserFoodUpdate): Promise<UserFood> {
  return (await api.patch<UserFood>(`/diary/foods/mine/${id}`, body)).data;
}

export async function apagarMeu(id: number | string): Promise<void> {
  await api.delete(`/diary/foods/mine/${id}`);
}

export async function listarReceitas(): Promise<FoodOption[]> {
  const r = await api.get<Recipe[]>("/recipes/");
  return (Array.isArray(r.data) ? r.data : []).map(opcaoDaReceita).filter((o): o is FoodOption => o !== null);
}

export async function listarRefeicoesProntas(): Promise<SavedMeal[]> {
  return (await api.get<{ items: SavedMeal[] }>("/diary/saved-meals")).data.items;
}

export async function salvarLote(body: DiaryBatchRequest): Promise<DiaryDay> {
  const dia = (await api.post<DiaryDay>("/diary/batch", body)).data;
  anunciarDia(dia);
  return dia;
}

export async function copiarDia(body: DiaryCopyRequest): Promise<DiaryDay> {
  const dia = (await api.post<DiaryDay>("/diary/copy", body)).data;
  anunciarDia(dia);
  return dia;
}

export async function salvarRefeicaoPronta(body: { name: string; entry_date: string; meal_slot: MealSlot }): Promise<SavedMeal> {
  return (await api.post<SavedMeal>("/diary/saved-meals", body)).data;
}

export async function registrarRefeicaoPronta(id: number, body: { entry_date: string; meal_slot: MealSlot }): Promise<DiaryDay> {
  const dia = (await api.post<DiaryDay>(`/diary/saved-meals/${id}/log`, body)).data;
  anunciarDia(dia);
  return dia;
}

export async function apagarRefeicaoPronta(id: number): Promise<void> {
  await api.delete(`/diary/saved-meals/${id}`);
}

export async function apagarEntrada(id: number): Promise<DiaryDay> {
  const dia = (await api.delete<DiaryDay>(`/diary/${id}`)).data;
  anunciarDia(dia);
  return dia;
}

/** Recria uma entrada apagada (desfazer): mesma referência, quantidade e unidade. */
export async function recriarEntrada(e: DiaryEntry): Promise<DiaryDay> {
  const dia = (
    await api.post<DiaryDay>("/diary", {
      entry_date: e.entry_date,
      meal_slot: e.meal_slot,
      food_ref: e.food_ref,
      quantity: e.quantity,
      unit: e.unit,
    })
  ).data;
  anunciarDia(dia);
  return dia;
}

export function mensagemDeErro(err: unknown, padrao: string): string {
  return extractDiaryErrorMessage(err, padrao);
}
