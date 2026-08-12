import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Dashboard } from "./Dashboard";
import { api } from "../lib/api";
import { makeDay, makeDayWithSlots, makeEntry } from "../test/diaryFactories";
import type { DiaryDay } from "../types";

vi.mock("../lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

/** Roteia o mock por URL: o dashboard faz 4 GETs independentes. */
function mockGets(day: DiaryDay | Error, extras: { weight?: unknown[] } = {}) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === "/diary") {
      return day instanceof Error ? Promise.reject(day) : Promise.resolve({ data: day } as never);
    }
    if (url === "/users/me") {
      return Promise.resolve({ data: { full_name: "Franco", score: 320 } } as never);
    }
    if (url === "/profiles/me") {
      return Promise.resolve({ data: { daily_calories: 2000, goal: "lose_weight" } } as never);
    }
    if (url === "/profiles/weight/history") {
      return Promise.resolve({ data: extras.weight ?? [] } as never);
    }
    return Promise.reject(new Error(`URL não esperada: ${url}`));
  });
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(api.get).mockReset();
});

describe("Dashboard — estado de carregamento", () => {
  it("announces that the day is loading before anything resolves", async () => {
    mockGets(makeDay());
    renderDashboard();

    expect(screen.getByRole("status")).toHaveTextContent("Carregando o seu dia");
  });
});

describe("Dashboard — estado de sucesso", () => {
  it("shows the day's totals straight from the API, without re-adding anything", async () => {
    const day = makeDayWithSlots(
      {
        cafe_da_manha: { logged_calories: 380.5, entries: [makeEntry({ calories_total: 380.5 })] },
        almoco: { logged_calories: 1106.8, entries: [makeEntry({ id: 2, calories_total: 1106.8 })] },
      },
      {
        // Repare: 380,5 + 1106,8 = 1487,3. A tela mostra o total do servidor,
        // não uma soma própria — por isso o valor aqui é o que ele mandou.
        totals: { calories: 1487.3, protein_g: 92.4, carbs_g: 168.1, fat_g: 48.9 },
        entries_count: 2,
        calories_target: 2100,
      },
    );
    mockGets(day);
    renderDashboard();

    // O total aparece em dois lugares legítimos (barra de energia e centro do donut de
    // macros), então a busca é escopada no card de energia — senão casa os dois.
    const energia = await screen.findByRole("region", { name: /Energia do dia/i });
    expect(within(energia).getByText("1.487")).toBeInTheDocument();
    expect(within(energia).getByText(/de 2.100 kcal registradas/)).toBeInTheDocument();
  });

  it("gives the segmented bar a text equivalent instead of communicating by colour alone", async () => {
    const day = makeDayWithSlots(
      { cafe_da_manha: { logged_calories: 380 }, jantar: { planned_calories: 420 } },
      { entries_count: 1, calories_target: 2000 },
    );
    mockGets(day);
    renderDashboard();

    const barra = await screen.findByRole("img", { name: /Energia do dia por refeição/ });
    expect(barra).toHaveAccessibleName(/Café da Manhã: 380 kcal registradas/);
    expect(barra).toHaveAccessibleName(/Jantar: 420 kcal planejadas/);
  });

  it("shows how much still fits in the day", async () => {
    const day = makeDay({
      calories_target: 2100,
      totals: { calories: 1487.3, protein_g: null, carbs_g: null, fat_g: null },
      entries_count: 3,
    });
    mockGets(day);
    renderDashboard();

    expect(await screen.findByText("Ainda cabem")).toBeInTheDocument();
    expect(screen.getByText("613")).toBeInTheDocument();
    expect(screen.getByText("kcal até a meta de hoje")).toBeInTheDocument();
  });

  it("flips to 'above target' rather than showing a negative number", async () => {
    const day = makeDay({
      calories_target: 2000,
      totals: { calories: 2300, protein_g: null, carbs_g: null, fat_g: null },
      entries_count: 5,
    });
    mockGets(day);
    renderDashboard();

    expect(await screen.findByText("Acima da meta")).toBeInTheDocument();
    expect(screen.getByText("300")).toBeInTheDocument();
  });
});

describe("Dashboard — marcação de estimativa", () => {
  it("labels an entry that came from the LLM as an estimate", async () => {
    // Requisito de segurança (RS-17 / ADR-0002 § 8): dado de origem `llm` ou
    // `openfoodfacts` não pode se apresentar com a autoridade da TACO.
    const day = makeDayWithSlots(
      {
        almoco: {
          logged_calories: 120,
          entries: [
            makeEntry({ id: 9, food_name: "Rap10 integral", source: "llm", is_estimate: true }),
          ],
        },
      },
      { entries_count: 1, has_estimate: true },
    );
    mockGets(day);
    renderDashboard();

    expect(await screen.findByText("Rap10 integral")).toBeInTheDocument();
    expect(screen.getByText("Estimativa")).toBeInTheDocument();
  });

  it("does not label a TACO entry as an estimate", async () => {
    const day = makeDayWithSlots(
      {
        almoco: {
          logged_calories: 146,
          entries: [makeEntry({ id: 10, source: "taco", is_estimate: false })],
        },
      },
      { entries_count: 1 },
    );
    mockGets(day);
    renderDashboard();

    expect(await screen.findByText("Ovo cozido")).toBeInTheDocument();
    expect(screen.queryByText("Estimativa")).not.toBeInTheDocument();
  });
});

describe("Dashboard — macros", () => {
  it("renders an unknown macro as a dash, never as 0 g", async () => {
    const day = makeDay({
      totals: { calories: 500, protein_g: 30, carbs_g: null, fat_g: 10 },
      entries_count: 2,
      macros_incomplete: true,
    });
    mockGets(day);
    renderDashboard();

    expect(await screen.findByText("Macros de hoje")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("0 g")).not.toBeInTheDocument();
  });

  it("warns that the split is partial when a macro is missing", async () => {
    const day = makeDay({
      totals: { calories: 500, protein_g: 30, carbs_g: null, fat_g: 10 },
      entries_count: 2,
      macros_incomplete: true,
    });
    mockGets(day);
    renderDashboard();

    expect(
      await screen.findByText(/Alguns alimentos do dia não informam macros/),
    ).toBeInTheDocument();
  });
});

describe("Dashboard — estado vazio", () => {
  it("invites a brand new user to act instead of saying 'no data found'", async () => {
    mockGets(makeDay());
    renderDashboard();

    expect(await screen.findByText(/Seu dia está em branco/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Registrar primeira refeição/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gerar um cardápio/ })).toBeInTheDocument();
    expect(screen.queryByText(/nenhum dado encontrado/i)).not.toBeInTheDocument();
  });

  it("still lists the six slots so the user can log straight into one", async () => {
    mockGets(makeDay());
    renderDashboard();

    expect(await screen.findByText("Café da Manhã")).toBeInTheDocument();
    expect(screen.getByText("Ceia")).toBeInTheDocument();
  });
});

describe("Dashboard — estado de erro", () => {
  it("explains the failure and offers a retry", async () => {
    mockGets(new Error("boom"));
    renderDashboard();

    expect(await screen.findByText(/Não conseguimos carregar o seu dia/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tentar de novo/ })).toBeInTheDocument();
  });

  it("announces the failure to assistive tech", async () => {
    mockGets(new Error("boom"));
    renderDashboard();

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Erro ao carregar/));
  });
});
