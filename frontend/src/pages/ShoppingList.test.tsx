import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ShoppingPage } from "./ShoppingList";
import { AlertProvider } from "../lib/AlertContext";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock("../lib/SubscriptionContext", () => ({
  useSubscription: () => ({ subscription: { plan: "plus", shopping_list_access: true } }),
}));

const lista = {
  id: 1,
  title: "Semana leve",
  created_at: "2026-11-05T10:00:00",
  items: [
    { id: 1, name: "Arroz", checked: true },
    { id: 2, name: "Frango", checked: false },
  ],
};

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.patch).mockReset();
  vi.mocked(api.get).mockResolvedValue({ data: [lista] } as never);
  vi.mocked(api.patch).mockResolvedValue({ data: {} } as never);
});

function renderTela() {
  return render(
    <MemoryRouter>
      <AlertProvider>
        <ShoppingPage />
      </AlertProvider>
    </MemoryRouter>,
  );
}

describe("Compras", () => {
  it("mostra o título, a contagem de itens no carrinho e a ação de adicionar", async () => {
    renderTela();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Lista do mercado");
    expect(await screen.findByText(/2 itens · 1 no carrinho/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar item" })).toBeInTheDocument();
  });

  it("marca um item pelo toque e avisa o servidor", async () => {
    const user = userEvent.setup();
    renderTela();
    const frango = await screen.findByRole("checkbox", { name: "Frango" });
    expect(frango).toHaveAttribute("aria-checked", "false");
    await user.click(frango);
    expect(api.patch).toHaveBeenCalledWith("/shopping/items/2/toggle");
    expect(await screen.findByText(/2 itens · 2 no carrinho/)).toBeInTheDocument();
  });
});
