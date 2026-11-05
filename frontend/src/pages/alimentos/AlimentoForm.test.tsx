import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "../../components/ui/Toast";
import { __limparToasts } from "../../components/ui/toastStore";
import { AlimentoForm } from "./AlimentoForm";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn(), patch: vi.fn() }));
vi.mock("../../lib/api", () => ({ api }));

function montar(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/alimentos/novo" element={<AlimentoForm />} />
        <Route path="/alimentos/:id" element={<AlimentoForm />} />
        <Route path="/alimentos" element={<div>lista</div>} />
      </Routes>
      <Toaster />
    </MemoryRouter>,
  );
}
beforeEach(() => { api.get.mockReset(); api.post.mockReset(); api.patch.mockReset(); api.delete.mockReset(); });
afterEach(() => act(() => __limparToasts()));

describe("AlimentoForm", () => {
  it("novo com ?barcode= preenche o código e envia macro em branco como null", async () => {
    api.post.mockResolvedValue({ data: { id: 1 } });
    montar("/alimentos/novo?barcode=7891097000123");
    expect((screen.getByLabelText(/Código de barras/) as HTMLInputElement).value).toBe("7891097000123");
    await userEvent.type(screen.getByLabelText("Nome"), "Iogurte");
    await userEvent.type(screen.getByLabelText(/Calorias/), "102");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/diary/foods/mine", {
      name: "Iogurte", portion_label: "1 porção", kcal: 102, portion_grams: null, protein_g: null, carbs_g: null, fat_g: null, barcode: "7891097000123",
    }));
    expect(await screen.findByText("lista")).toBeTruthy();
  });

  it("sem calorias não envia e avisa", async () => {
    montar("/alimentos/novo");
    await userEvent.type(screen.getByLabelText("Nome"), "Chá");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/calorias/);
    expect(api.post).not.toHaveBeenCalled();
  });

  it("código repetido mostra a mensagem do servidor", async () => {
    api.post.mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { detail: { code: "BARCODE_ALREADY_USED", message: "Você já tem um alimento com esse código." } } } });
    montar("/alimentos/novo");
    await userEvent.type(screen.getByLabelText("Nome"), "X");
    await userEvent.type(screen.getByLabelText(/Calorias/), "10");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect((await screen.findByRole("alert")).textContent).toContain("já tem um alimento");
  });

  it("editar carrega o alimento e apagar pede confirmação", async () => {
    api.get.mockResolvedValue({ data: { id: 4, name: "Pão", portion_label: "1 fatia", portion_grams: 30, kcal: 80, protein_g: null, carbs_g: 15, fat_g: null, barcode: null } });
    api.delete.mockResolvedValue({ data: { ok: true } });
    montar("/alimentos/4");
    expect(((await screen.findByLabelText("Nome")) as HTMLInputElement).value).toBe("Pão");
    await userEvent.click(screen.getByRole("button", { name: "Apagar alimento" }));
    await userEvent.click(await screen.findByRole("button", { name: "Apagar" }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/diary/foods/mine/4"));
  });
});
