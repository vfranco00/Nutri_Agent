import type { Recipe } from "../types";

/** Rótulos com acento para todas as categorias/refeições de receita. */
export const ROTULOS_CATEGORIA: Record<string, string> = {
  cafe_da_manha: "Café da manhã",
  lanche_manha: "Lanche da manhã",
  almoco: "Almoço",
  lanche: "Lanche",
  lanche_tarde: "Lanche da tarde",
  jantar: "Jantar",
  ceia: "Ceia",
  doce: "Doce",
  salgado: "Salgado",
  sobremesa: "Sobremesa",
};

export function rotuloCategoria(categoria?: string | null): string {
  if (!categoria) return "Geral";
  return ROTULOS_CATEGORIA[categoria.toLowerCase()] ?? categoria.replace(/_/g, " ");
}

/** "320 kcal", ou "kcal a calcular" quando as calorias estão em Auto (sem valor). */
export function rotuloKcal(calorias?: number | null): string {
  return calorias ? `${Math.round(calorias)} kcal` : "kcal a calcular";
}

/** Tira receitas repetidas, mantendo a primeira ocorrência de cada id. */
export function semDuplicadas(receitas: Recipe[]): Recipe[] {
  const vistos = new Set<number | string>();
  return receitas.filter((r) => (vistos.has(r.id) ? false : (vistos.add(r.id), true)));
}
