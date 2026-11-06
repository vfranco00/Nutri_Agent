import type { MealSlot } from "../../types";

/**
 * Espaços vazios do Hoje, que outras frentes preenchem depois (trocando o corpo da função):
 * - `Agua` (frente A): cartão de água, entre o medidor e as refeições;
 * - `Repetir` (frente R): botão "repetir o de ontem" numa refeição vazia.
 * Hoje os dois não desenham nada.
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
function Repetir(props: RepetirSlotProps): null {
  void props;
  return null;
}

export const HojeSlots = { Agua, Repetir };
