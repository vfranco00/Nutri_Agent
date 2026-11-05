import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "../../components/ui/Toast";
import { __limparToasts } from "../../components/ui/toastStore";
import { Registrar } from "./Registrar";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn(), patch: vi.fn() }));
vi.mock("../../lib/api", () => ({ api }));

const dia = (ids: number[]) => ({
  date: "2026-11-05", totals: { calories: 0 }, entries_count: ids.length,
  slots: [{ slot: "almoco", label: "Almoço", entries: ids.map((id) => ({ id, entry_date: "2026-11-05", meal_slot: "almoco" })), planned_meals: [], logged_calories: 0, planned_calories: 0 }],
});

function montar(onClose = vi.fn()) {
  render(
    <MemoryRouter initialEntries={["/registrar?refeicao=almoco&data=2026-11-05"]}>
      <Registrar onClose={onClose} />
      <Toaster />
    </MemoryRouter>,
  );
  return onClose;
}

beforeEach(() => {
  api.get.mockReset(); api.post.mockReset(); api.delete.mockReset();
  api.get.mockImplementation((url: string) => {
    if (url === "/diary/foods/mine") return Promise.resolve({ data: { items: [{ id: 3, food_ref: "mine:3", name: "Ovo caipira", portion_label: "1 ovo", portion_grams: null, kcal: 70, protein_g: 6, carbs_g: null, fat_g: 5, barcode: null, created_at: "" }] } });
    if (url === "/diary") return Promise.resolve({ data: dia([]) });
    return Promise.resolve({ data: { items: [] } });
  });
});
afterEach(() => act(() => __limparToasts()));

describe("Registrar", () => {
  it("mostra as 5 abas e o destino", () => {
    montar();
    for (const n of ["Buscar", "Recentes", "Frequentes", "Meus", "Receitas"]) expect(screen.getByRole("tab", { name: n })).toBeTruthy();
    expect(screen.getByText(/Almoço · Hoje|Almoço · /)).toBeTruthy();
  });

  it("a aba Meus lista o alimento pessoal; o + põe no carrinho; Salvar manda o lote e oferece Desfazer", async () => {
    api.post.mockResolvedValue({ data: dia([10, 11]) });
    api.delete.mockResolvedValue({ data: dia([]) });
    const onClose = montar();
    await userEvent.click(screen.getByRole("tab", { name: "Meus" }));
    await userEvent.click(await screen.findByRole("button", { name: "Adicionar Ovo caipira" }));
    expect(screen.getByText(/1 item · 70 kcal/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/diary/batch", {
      entry_date: "2026-11-05", meal_slot: "almoco", items: [{ food_ref: "mine:3", quantity: 1, unit: "porcao" }],
    }));
    expect(onClose).toHaveBeenCalled();
    await userEvent.click(await screen.findByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/diary/11"));
  });

  it("a folha de porção leva ao leitor de código de barras", async () => {
    montar();
    await userEvent.click(screen.getByRole("tab", { name: "Meus" }));
    await userEvent.click(await screen.findByText("Ovo caipira"));
    const link = await screen.findByRole("link", { name: /Código de barras/ });
    expect(link.getAttribute("href")).toBe("/registrar/codigo-de-barras");
  });

  it("aba vazia explica o que aparece ali", async () => {
    montar();
    await userEvent.click(screen.getByRole("tab", { name: "Recentes" }));
    expect(await screen.findByText(/os últimos aparecem aqui/)).toBeTruthy();
  });

  it("'Repetir café de ontem' copia o dia anterior só daquela refeição", async () => {
    api.get.mockImplementation((url: string, cfg?: { params?: { date?: string } }) => {
      if (url === "/diary" && cfg?.params?.date === "2026-11-04")
        return Promise.resolve({ data: { ...dia([1]), slots: [{ slot: "almoco", label: "Almoço", logged_calories: 461, planned_calories: 0, planned_meals: [], entries: [{ id: 1, food_name: "Arroz" }, { id: 2, food_name: "Feijão" }] }] } });
      return Promise.resolve({ data: { items: [] } });
    });
    api.post.mockResolvedValue({ data: dia([5, 6]) });
    montar();
    const cartao = await screen.findByRole("button", { name: /Repetir almoço de ontem/ });
    expect(cartao.textContent).toContain("arroz, feijão");
    expect(cartao.textContent).toContain("461 kcal");
    fireEvent.click(cartao);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/diary/copy", { from_date: "2026-11-04", to_date: "2026-11-05", meal_slot: "almoco" }));
  });
});
