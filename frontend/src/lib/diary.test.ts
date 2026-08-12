import { describe, it, expect } from "vitest";
import {
  buildEnergyBar,
  buildMacroDonut,
  buildNextSteps,
  describeEnergyBar,
  describeMacroDonut,
  extractDiaryErrorMessage,
  formatDensity,
  formatGrams,
  formatKcal,
  isDayEmpty,
  remainingCalories,
  shiftIsoDate,
  toIsoDate,
} from "./diary";
import { makeDay, makeDayWithSlots, makeEntry } from "../test/diaryFactories";

describe("toIsoDate", () => {
  it("uses the local date, not the UTC one", () => {
    // 23h30 de 11/08 no Brasil já é 12/08 em UTC. RS-09 fala em data LOCAL do
    // usuário: usar toISOString() aqui registraria a ceia no dia seguinte.
    const tarde = new Date(2026, 7, 11, 23, 30);
    expect(toIsoDate(tarde)).toBe("2026-08-11");
  });

  it("pads month and day", () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("shiftIsoDate", () => {
  it("walks backwards across a month boundary", () => {
    expect(shiftIsoDate("2026-08-01", -1)).toBe("2026-07-31");
  });

  it("walks forwards across a year boundary", () => {
    expect(shiftIsoDate("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("formatGrams", () => {
  it("renders an unknown macro as a dash, never as zero", () => {
    // § 9.4: null é DESCONHECIDO. "0 g de proteína" é uma afirmação
    // nutricional que ninguém fez.
    expect(formatGrams(null)).toBe("—");
  });

  it("renders a real zero as zero", () => {
    expect(formatGrams(0)).toBe("0 g");
  });

  it("keeps one decimal place", () => {
    expect(formatGrams(92.4)).toBe("92,4 g");
  });
});

describe("formatKcal", () => {
  it("groups thousands in pt-BR and drops the decimal", () => {
    expect(formatKcal(1487.3)).toBe("1.487");
  });
});

describe("formatDensity", () => {
  it("shows the value per base unit without multiplying by 100", () => {
    // § 4.0: a divisão por 100 acontece uma vez, no seeder. Multiplicar de
    // volta na tela reabre o erro clássico de fator 100.
    expect(formatDensity(1.28, "g")).toBe("1,28 kcal por g");
  });

  it("names the unit for count-based foods", () => {
    expect(formatDensity(70, "un")).toBe("70 kcal por unidade");
  });
});

describe("buildEnergyBar", () => {
  it("emits a solid block for what was logged and a hatched one for what is only planned", () => {
    const day = makeDayWithSlots({
      cafe_da_manha: { logged_calories: 380 },
      jantar: { planned_calories: 420 },
    });

    const { segments } = buildEnergyBar(day);

    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ kind: "logged", weight: 380, displayKcal: 380 });
    expect(segments[1]).toMatchObject({ kind: "planned", weight: 420, displayKcal: 420 });
  });

  it("hatches only the unlogged remainder of a partially logged slot", () => {
    const day = makeDayWithSlots({
      cafe_da_manha: { logged_calories: 380, planned_calories: 400 },
    });

    const { segments } = buildEnergyBar(day);

    expect(segments.map((s) => s.kind)).toEqual(["logged", "planned"]);
    expect(segments[1].weight).toBe(20);
  });

  it("does not print a number on a block whose value the API never sent", () => {
    // 400 - 380 = 20 é largura, não um total que o servidor afirmou. Sem número.
    const day = makeDayWithSlots({
      cafe_da_manha: { logged_calories: 380, planned_calories: 400 },
    });

    const { segments } = buildEnergyBar(day);

    expect(segments[1].displayKcal).toBeNull();
  });

  it("omits the hatched block when the slot is already over its plan", () => {
    const day = makeDayWithSlots({
      almoco: { logged_calories: 700, planned_calories: 500 },
    });

    const { segments } = buildEnergyBar(day);

    expect(segments).toHaveLength(1);
    expect(segments[0].kind).toBe("logged");
  });

  it("scales against the target while the day still fits inside it", () => {
    const day = makeDayWithSlots({ almoco: { logged_calories: 600 } }, { calories_target: 2000 });
    expect(buildEnergyBar(day).scale).toBe(2000);
  });

  it("scales against the day itself once it overflows the target", () => {
    const day = makeDayWithSlots({ almoco: { logged_calories: 2500 } }, { calories_target: 2000 });
    expect(buildEnergyBar(day).scale).toBe(2500);
  });

  it("reports an empty bar for a day with nothing logged and nothing planned", () => {
    expect(buildEnergyBar(makeDay()).isEmpty).toBe(true);
  });
});

describe("describeEnergyBar", () => {
  it("puts every slot's numbers into text, so the bar is not colour-only", () => {
    const day = makeDayWithSlots(
      { cafe_da_manha: { logged_calories: 380 }, jantar: { planned_calories: 420 } },
      { calories_target: 2000 },
    );

    const texto = describeEnergyBar(day);

    expect(texto).toContain("Café da Manhã: 380 kcal registradas");
    expect(texto).toContain("Jantar: 420 kcal planejadas");
    expect(texto).toContain("2.000 kcal");
  });

  it("says there is no target instead of inventing one", () => {
    const day = makeDayWithSlots(
      { almoco: { logged_calories: 500 } },
      { calories_target: null },
    );
    expect(describeEnergyBar(day)).toContain("Sem meta calórica definida");
  });
});

describe("buildMacroDonut", () => {
  it("splits by grams and accumulates the offsets", () => {
    const donut = buildMacroDonut({ calories: 1000, protein_g: 50, carbs_g: 100, fat_g: 50 });

    expect(donut.slices.map((s) => s.key)).toEqual(["protein", "carbs", "fat"]);
    expect(donut.slices[0]).toMatchObject({ percent: 25, offset: -0 });
    expect(donut.slices[1]).toMatchObject({ percent: 50, offset: -25 });
    expect(donut.slices[2]).toMatchObject({ percent: 25, offset: -75 });
  });

  it("leaves an unknown macro out of the donut instead of drawing a zero slice", () => {
    const donut = buildMacroDonut({ calories: 500, protein_g: 30, carbs_g: null, fat_g: 10 });
    expect(donut.slices.map((s) => s.key)).toEqual(["protein", "fat"]);
  });

  it("is empty when no macro is known", () => {
    const donut = buildMacroDonut({ calories: 500, protein_g: null, carbs_g: null, fat_g: null });
    expect(donut.isEmpty).toBe(true);
    expect(donut.slices).toEqual([]);
  });
});

describe("describeMacroDonut", () => {
  it("warns that the split is partial when some macro is missing", () => {
    const texto = describeMacroDonut(
      { calories: 500, protein_g: 30, carbs_g: null, fat_g: 10 },
      true,
    );
    expect(texto).toContain("parcial");
  });
});

describe("remainingCalories", () => {
  it("returns what still fits in the day", () => {
    const day = makeDay({
      calories_target: 2100,
      totals: { calories: 1487.3, protein_g: null, carbs_g: null, fat_g: null },
    });
    // Sem tratamento, 2100 - 1487.3 vira 612.7000000000003 em ponto flutuante.
    expect(remainingCalories(day)).toBe(612.7);
  });

  it("goes negative when the day passed the target", () => {
    const day = makeDay({
      calories_target: 2000,
      totals: { calories: 2300, protein_g: null, carbs_g: null, fat_g: null },
    });
    expect(remainingCalories(day)).toBe(-300);
  });

  it("is null when the profile has no target", () => {
    expect(remainingCalories(makeDay({ calories_target: null }))).toBeNull();
  });
});

describe("isDayEmpty", () => {
  it("is empty for a brand new user: nothing logged and nothing planned", () => {
    expect(isDayEmpty(makeDay())).toBe(true);
  });

  it("is not empty when a plan exists even without any entry", () => {
    const day = makeDay({
      planned_totals: { calories: 2050, protein_g: null, carbs_g: null, fat_g: null },
    });
    expect(isDayEmpty(day)).toBe(false);
  });

  it("is not empty as soon as something is logged", () => {
    expect(isDayEmpty(makeDay({ entries_count: 1 }))).toBe(false);
  });
});

describe("extractDiaryErrorMessage", () => {
  it("maps a business error object by its code", () => {
    const err = {
      response: { status: 404, data: { detail: { code: "FOOD_NOT_FOUND", message: "x" } } },
    };
    expect(extractDiaryErrorMessage(err, "fallback")).toContain("Não encontramos esse alimento");
  });

  it("explains the circuit breaker instead of pretending the food does not exist", () => {
    const err = {
      response: {
        status: 503,
        data: { detail: { code: "FOOD_RESOLVER_UNAVAILABLE", message: "x" } },
      },
    };
    expect(extractDiaryErrorMessage(err, "fallback")).toContain("indisponível");
  });

  it("reads only `msg` from a 422 array", () => {
    const err = {
      response: {
        status: 422,
        data: { detail: [{ type: "greater_than", loc: ["body", "quantity"], msg: "deve ser > 0" }] },
      },
    };
    expect(extractDiaryErrorMessage(err, "fallback")).toBe("deve ser > 0");
  });

  it("never surfaces `detail[].input`, even if a payload still carries it", () => {
    // RS-12: o handler global removeu `input` de toda a API. Este teste trava a
    // regra no cliente também — nome de alimento é dado de saúde (RS-27).
    const err = {
      response: {
        status: 422,
        data: {
          detail: [{ type: "string_too_long", loc: ["body", "name"], msg: "muito longo", input: "Ensure Plus" }],
        },
      },
    };
    expect(extractDiaryErrorMessage(err, "fallback")).not.toContain("Ensure Plus");
  });

  it("handles the rate limit without leaking the raw error", () => {
    expect(extractDiaryErrorMessage({ response: { status: 429 } }, "fallback")).toContain(
      "Muitas tentativas",
    );
  });

  it("falls back when there is no response at all", () => {
    expect(extractDiaryErrorMessage(new Error("network down"), "fallback")).toBe("fallback");
  });
});

describe("buildNextSteps", () => {
  it("asks for the calorie target first when the profile has none", () => {
    const passos = buildNextSteps({
      day: makeDay(),
      hasCalorieTarget: false,
      hasWeightHistory: true,
    });
    expect(passos[0].id).toBe("completar-perfil");
  });

  it("suggests logging a meal while the day is still empty", () => {
    const passos = buildNextSteps({
      day: makeDay(),
      hasCalorieTarget: true,
      hasWeightHistory: true,
    });
    expect(passos.map((p) => p.id)).toContain("registrar-refeicao");
  });

  it("stops suggesting what the user already did", () => {
    const day = makeDay({
      entries_count: 3,
      meal_plan: {
        binding_id: 1,
        meal_plan_id: 2,
        title: "Semana de corte",
        day_label: "Segunda-feira",
        day_index: 0,
      },
    });
    const passos = buildNextSteps({ day, hasCalorieTarget: true, hasWeightHistory: true });
    expect(passos).toEqual([]);
  });
});

describe("entry factory sanity", () => {
  it("keeps the six canonical slots in order", () => {
    expect(makeDay().slots.map((s) => s.slot)).toEqual([
      "cafe_da_manha",
      "lanche_manha",
      "almoco",
      "lanche_tarde",
      "jantar",
      "ceia",
    ]);
  });

  it("builds an estimate entry when asked", () => {
    const e = makeEntry({ source: "llm", is_estimate: true });
    expect(e.is_estimate).toBe(true);
  });
});
