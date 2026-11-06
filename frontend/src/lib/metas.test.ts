import { describe, it, expect, beforeEach } from "vitest";
import { jaComemorou, marcarComemorada, metasBatidas } from "./metas";
import { makeDay } from "../test/diaryFactories";
import type { Profile } from "../types";

beforeEach(() => localStorage.clear());

describe("metas do dia", () => {
  it("calorias batidas quando o registrado alcança a meta", () => {
    const dia = makeDay({ calories_target: 2000, totals: { calories: 2000, protein_g: null, carbs_g: null, fat_g: null } });
    expect(metasBatidas(dia, null)).toEqual(["calorias"]);
    const antes = makeDay({ calories_target: 2000, totals: { calories: 1999, protein_g: null, carbs_g: null, fat_g: null } });
    expect(metasBatidas(antes, null)).toEqual([]);
  });

  it("proteína só conta se o perfil trouxer a meta", () => {
    const dia = makeDay({ calories_target: null, totals: { calories: 100, protein_g: 130, carbs_g: null, fat_g: null } });
    expect(metasBatidas(dia, null)).toEqual([]);
    const perfil = { daily_protein_g: 120 } as unknown as Profile;
    expect(metasBatidas(dia, perfil)).toEqual(["proteina"]);
  });

  it("lembra por data que já comemorou", () => {
    expect(jaComemorou("2026-11-05", "calorias")).toBe(false);
    marcarComemorada("2026-11-05", "calorias");
    expect(jaComemorou("2026-11-05", "calorias")).toBe(true);
    expect(jaComemorou("2026-11-06", "calorias")).toBe(false);
  });
});
