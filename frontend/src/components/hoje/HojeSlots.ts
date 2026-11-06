import type { MealSlot } from "../../types";
import { RepetirDeOntem } from "./RepetirDeOntem";

/**
 * Espaços do Hoje que outras frentes preenchem (trocando o corpo da função):
 * - `Agua` (frente A): cartão de água, entre o medidor e as refeições;
 * - `Repetir` (frente R): botão "repetir o de ontem" numa refeição vazia (`RepetirDeOntem`).
 */
export interface AguaSlotProps {
  /** Data em foco, 'YYYY-MM-DD'. */
  date: string;
}
export interface RepetirSlotProps {
  date: string;
  slot: MealSlot;
}

function Agua(props: AguaSlotProps): null {
  void props;
  return null;
}

export const HojeSlots = { Agua, Repetir: RepetirDeOntem };
