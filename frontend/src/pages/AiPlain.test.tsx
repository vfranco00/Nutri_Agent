import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AiPlan } from "./AiPlain";
import { AlertProvider } from "../lib/AlertContext";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("../lib/SubscriptionContext", () => ({
  useSubscription: () => ({
    subscription: { plan: "plus", shopping_list_access: true },
    getUsage: () => null,
    refreshSubscription: vi.fn(),
  }),
}));

beforeEach(() => {
  localStorage.removeItem("nuvi_current_plan");
  vi.mocked(api.post).mockReset();
});

function renderTela() {
  return render(
    <MemoryRouter>
      <AlertProvider>
        <AiPlan />
      </AlertProvider>
    </MemoryRouter>,
  );
}

describe("Gerar cardápio", () => {
  it("mostra o título e a ação principal, e o botão acompanha os dias escolhidos", async () => {
    const user = userEvent.setup();
    renderTela();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Monte meu cardápio");
    expect(screen.getByRole("button", { name: /Gerar cardápio de 1 dia/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "7 dias" }));
    expect(screen.getByRole("button", { name: /Gerar cardápio de 7 dias/ })).toBeInTheDocument();
  });

  it("pede o plano à IA com os dias e as refeições escolhidos", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValue({
      data: {
        plan_token: "t",
        days: [
          {
            day: "Dia 1",
            calories_target: 1950,
            macros: { protein: "120 g", carbs: "200 g", fats: "60 g" },
            tip: "Beba água",
            meals: [{ name: "Café", suggestion: "Panqueca de aveia", category: "cafe_da_manha" }],
          },
        ],
      },
    } as never);
    renderTela();

    await user.click(screen.getByRole("button", { name: "4 refeições" }));
    await user.click(screen.getByRole("button", { name: /Gerar cardápio de 1 dia/ }));

    expect(api.post).toHaveBeenCalledWith("/ai/generate-plan", { days: 1, variety: "varied", meals_count: 4 });
    expect(await screen.findByText("Panqueca de aveia")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar plano/ })).toBeInTheDocument();
  });
});
