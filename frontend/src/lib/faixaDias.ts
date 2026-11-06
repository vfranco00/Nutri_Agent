import { shiftIsoDate } from "./diary";

/** Sete dias em volta do dia em foco: três antes, ele e três depois. */
export function diasDaFaixa(date: string): string[] {
  return [-3, -2, -1, 0, 1, 2, 3].map((d) => shiftIsoDate(date, d));
}
