import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { MealPlans } from "./MealPlans";
import { AlertProvider } from "../lib/AlertContext";
import { api } from "../lib/api";
import { makeDayWithSlots } from "../test/diaryFactories";

vi.mock("../lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const plano = (id: number, title: string) => ({
  id,
  user_id: 1,
  title,
  source: "ai",
  created_at: "2026-10-20T10:00:00",
  days: [{ id: id * 10, meal_plan_id: id, day_label: "Dia 1", day_index: 0, meals: [] }],
});

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === "/diary") {
      return Promise.resolve({
        data: makeDayWithSlots(
          { jantar: { planned_calories: 540, planned_meals: [{ id: 9, recipe_id: null, title: "Bowl de frango", calories: 540 }] } },
          { meal_plan: { binding_id: 1, meal_plan_id: 1, title: "Semana leve", day_label: "Segunda", day_index: 0 } },
        ),
      } as never);
    }
    if (url === "/meal-plans/") return Promise.resolve({ data: [plano(1, "Semana leve"), plano(2, "Plano B")] } as never);
    return Promise.resolve({ data: [] } as never);
  });
});

function renderTela() {
  return render(
    <MemoryRouter>
      <AlertProvider>
        <MealPlans />
      </AlertProvider>
    </MemoryRouter>,
  );
}

describe("Cardápios", () => {
  it("mostra o título, o cardápio ativo e a refeição planejada do dia", async () => {
    renderTela();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Cardápio da semana");
    expect(await screen.findByText("Bowl de frango")).toBeInTheDocument();
    expect(screen.getByText("“Semana leve”")).toBeInTheDocument();
  });

  it("em Meus cardápios marca o ativo e oferece Ativar nos outros", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValue({ data: {} } as never);
    renderTela();
    await user.click(screen.getByRole("tab", { name: "Meus cardápios" }));

    expect(await screen.findByText("ATIVO")).toBeInTheDocument();
    const ativar = screen.getAllByRole("button", { name: "Ativar" });
    expect(ativar).toHaveLength(1);
    await user.click(ativar[0]);
    expect(api.post).toHaveBeenCalledWith("/diary/plan-bindings", expect.objectContaining({ meal_plan_id: 2 }));
  });
});
