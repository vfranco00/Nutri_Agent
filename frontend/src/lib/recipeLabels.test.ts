import { describe, expect, it } from "vitest";
import { rotuloCategoria, rotuloKcal, semDuplicadas } from "./recipeLabels";
import type { Recipe } from "../types";

describe("recipeLabels", () => {
  it("rotula categorias com acento", () => {
    expect(rotuloCategoria("almoco")).toBe("Almoço");
    expect(rotuloCategoria("cafe_da_manha")).toBe("Café da manhã");
    expect(rotuloCategoria("ALMOCO")).toBe("Almoço");
    expect(rotuloCategoria(undefined)).toBe("Geral");
    expect(rotuloCategoria("vegano_x")).toBe("vegano x");
  });
  it("kcal em Auto não vira 0 kcal", () => {
    expect(rotuloKcal(0)).toBe("kcal a calcular");
    expect(rotuloKcal(undefined)).toBe("kcal a calcular");
    expect(rotuloKcal(null)).toBe("kcal a calcular");
    expect(rotuloKcal(320.4)).toBe("320 kcal");
  });
  it("remove duplicadas por id", () => {
    const r = [{ id: 1 }, { id: 2 }, { id: 1 }] as Recipe[];
    expect(semDuplicadas(r).map((x) => x.id)).toEqual([1, 2]);
  });
});
