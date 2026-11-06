import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Agente } from "./Agente";
import { AiChef } from "./AiChef";
import { AiPlan } from "./AiPlain";
import { NewRecipe } from "./NewRecipe";
import { api } from "../lib/api";
import { AlertProvider } from "../lib/AlertContext";

vi.mock("../lib/ia", () => ({ IA_DISPONIVEL: false }));
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

function Local() {
  const l = useLocation();
  return <div data-testid="local">{l.pathname}</div>;
}

function montar(ui: React.ReactElement, inicial: string) {
  return render(
    <MemoryRouter initialEntries={[inicial]}>
      <AlertProvider>
        <Routes>
          <Route path={inicial} element={ui} />
          <Route path="*" element={<Local />} />
        </Routes>
      </AlertProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(api.get).mockReset().mockResolvedValue({ data: {} });
  vi.mocked(api.post).mockReset().mockResolvedValue({ data: {} });
});

describe("IA desligada: Em breve, sem chamar a API", () => {
  it("Agente mostra Em breve e leva para o registro", async () => {
    montar(<Agente />, "/agente");
    expect(screen.getByRole("heading", { name: "Em breve" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Registrar comida" }));
    expect(api.post).not.toHaveBeenCalled();
    expect(api.get).not.toHaveBeenCalled();
  });

  it("Gerar cardápio mostra Em breve e leva para Montar cardápio", async () => {
    montar(<AiPlan />, "/cardapios/gerar");
    expect(screen.getByRole("heading", { name: "Em breve" })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Montar cardápio" }));
    expect(screen.getByTestId("local")).toHaveTextContent("/cardapios/novo");
    expect(api.post).not.toHaveBeenCalled();
  });

  it("Chef mostra Em breve e leva para a nova receita", async () => {
    montar(<AiChef />, "/chef");
    expect(screen.getByRole("heading", { name: "Em breve" })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Criar receita" }));
    expect(screen.getByTestId("local")).toHaveTextContent("/receitas/nova");
    expect(api.post).not.toHaveBeenCalled();
  });

  it("Nova receita sinaliza Em breve nas calorias e não chama a IA ao sair do campo", async () => {
    montar(<NewRecipe />, "/receitas/nova");
    expect(screen.getAllByText("Em breve").length).toBeGreaterThan(0);
    expect(api.post).not.toHaveBeenCalled();
  });
});
