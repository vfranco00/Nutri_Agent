import type { DiaryDay, Profile } from "../types";

export type MetaBatida = "calorias" | "proteina";

/** O perfil ainda não guarda meta de proteína; se um dia guardar, este campo opcional a traz. */
type PerfilComProteina = Profile & { daily_protein_g?: number | null };

/** Metas do dia que já foram atingidas (kcal registradas ≥ meta; proteína ≥ meta, se houver). */
export function metasBatidas(day: DiaryDay, profile: Profile | null): MetaBatida[] {
  const lista: MetaBatida[] = [];
  const kcalMeta = day.calories_target ?? profile?.daily_calories ?? null;
  if (kcalMeta && day.totals.calories >= kcalMeta) lista.push("calorias");
  const protMeta = (profile as PerfilComProteina | null)?.daily_protein_g ?? null;
  if (protMeta && (day.totals.protein_g ?? 0) >= protMeta) lista.push("proteina");
  return lista;
}

const chave = (data: string, meta: MetaBatida) => `nuvi:meta:${data}:${meta}`;

/** Já comemorou esta meta neste dia? (localStorage por data; sem acesso, trata como já feito = não repete) */
export function jaComemorou(data: string, meta: MetaBatida): boolean {
  try {
    return localStorage.getItem(chave(data, meta)) === "1";
  } catch {
    return true;
  }
}

export function marcarComemorada(data: string, meta: MetaBatida): void {
  try {
    localStorage.setItem(chave(data, meta), "1");
  } catch {
    /* sem armazenamento: segue sem lembrar */
  }
}

export const ROTULO_META: Record<MetaBatida, string> = {
  calorias: "Meta de calorias batida",
  proteina: "Meta de proteína batida",
};
