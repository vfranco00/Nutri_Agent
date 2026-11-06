import cafe from "../assets/refeicoes/cafe.jpg";
import almoco from "../assets/refeicoes/almoco.jpg";
import lanche from "../assets/refeicoes/lanche.jpg";
import jantar from "../assets/refeicoes/jantar.jpg";
import type { MealSlot } from "../types";

/** Foto fixa por refeição (Unsplash, uso comercial livre). Receita sem foto usa esta. */
export const FOTO_POR_SLOT: Record<MealSlot, string> = {
  cafe_da_manha: cafe,
  lanche_manha: lanche,
  almoco,
  lanche_tarde: lanche,
  jantar,
  ceia: jantar,
};

/** Descobre a refeição pelo texto do rótulo ("Café", "Almoço", "Jantar"…). Padrão: almoço. */
export function fotoPorRotulo(rotulo: string | null | undefined): string {
  const t = (rotulo ?? "").toLowerCase();
  if (t.includes("caf")) return cafe;
  if (t.includes("lanche")) return lanche;
  if (t.includes("jant") || t.includes("ceia")) return jantar;
  return almoco;
}
