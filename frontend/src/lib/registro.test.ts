import { describe, expect, it } from "vitest";
import { idsNovosDoLote, opcaoDaReceita, padraoDoMais, previa, refeicaoDoSlot, SLOT_DA_REFEICAO } from "./registro";
import type { DiaryDay, FoodOption, Recipe } from "../types";

const arroz: FoodOption = {
  food_ref: "catalog:arroz", name: "Arroz", base_unit: "g", kcal_per_base_unit: 1.3,
  protein_per_base_unit: 0.025, carbs_per_base_unit: null, fat_per_base_unit: 0.002,
  allowed_units: ["g", "colher_sopa", "xicara"], source: "taco", is_estimate: false,
};
const ovo: FoodOption = {
  food_ref: "mine:3", name: "Ovo", base_unit: "un", kcal_per_base_unit: 70,
  protein_per_base_unit: 6, carbs_per_base_unit: 0.5, fat_per_base_unit: 5,
  allowed_units: ["un", "fatia", "porcao"], source: "user", is_estimate: false,
};

describe("previa", () => {
  it("g usa a quantidade direto e macro nulo continua nulo", () => {
    const p = previa(arroz, 100, "g");
    expect(p.kcal).toBeCloseTo(130);
    expect(p.c).toBeNull();
    expect(p.p).toBeCloseTo(2.5);
  });
  it("colher de sopa vale 15 g, como no servidor", () => {
    expect(previa(arroz, 2, "colher_sopa").kcal).toBeCloseTo(39);
  });
  it("porção de alimento pessoal multiplica por 1", () => {
    expect(previa(ovo, 2, "porcao").kcal).toBe(140);
  });
});

describe("padraoDoMais", () => {
  it("100 g para massa; 1 porção para contagem", () => {
    expect(padraoDoMais(arroz)).toEqual({ quantity: 100, unit: "g" });
    expect(padraoDoMais(ovo)).toEqual({ quantity: 1, unit: "porcao" });
  });
});

describe("refeições e slots", () => {
  it("as 4 refeições da folha mapeiam para slots da API", () => {
    expect(SLOT_DA_REFEICAO).toEqual({ cafe: "cafe_da_manha", almoco: "almoco", lanche: "lanche_tarde", jantar: "jantar" });
    expect(refeicaoDoSlot("ceia")).toBe("jantar");
    expect(refeicaoDoSlot("lanche_manha")).toBe("cafe");
  });
});

describe("opcaoDaReceita", () => {
  const base = { id: 7, user_id: 1, title: "Omelete", instructions: "" } as Recipe;
  it("usa calories da porção", () => {
    expect(opcaoDaReceita({ ...base, calories: 450 })?.food_ref).toBe("recipe:7");
  });
  it("sem calories soma os ingredientes", () => {
    const r = opcaoDaReceita({ ...base, ingredients: [{ name: "a", quantity: 1, unit: "g", calories: 100 }, { name: "b", quantity: 1, unit: "g", calories: 50 }] });
    expect(r?.kcal_per_base_unit).toBe(150);
  });
  it("sem kcal não vira alimento", () => {
    expect(opcaoDaReceita(base)).toBeNull();
  });
});

describe("idsNovosDoLote", () => {
  it("pega as n maiores ids do slot", () => {
    const e = (id: number) => ({ id }) as never;
    const day = { slots: [{ slot: "almoco", entries: [e(1), e(5), e(9), e(7)] }] } as unknown as DiaryDay;
    expect(idsNovosDoLote(day, "almoco", 2)).toEqual([9, 7]);
  });
});
