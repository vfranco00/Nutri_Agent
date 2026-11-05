import { useState } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "../ui/Toast";
import { __limparToasts } from "../ui/toastStore";
import { MenuDia, MenuRefeicao } from "./MenusDoDiario";
import type { DiaryEntry } from "../../types";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn(), patch: vi.fn() }));
vi.mock("../../lib/api", () => ({ api }));

const entrada = (id: number): DiaryEntry => ({ id, entry_date: "2026-11-05", meal_slot: "cafe_da_manha", food_ref: `catalog:x${id}`, food_name: `X${id}`, quantity: 2, unit: "un" } as DiaryEntry);
const diaVazio = { date: "2026-11-05", slots: [], totals: { calories: 0 }, entries_count: 0 };

beforeEach(() => { api.post.mockReset(); api.delete.mockReset(); api.post.mockResolvedValue({ data: diaVazio }); api.delete.mockResolvedValue({ data: diaVazio }); });
afterEach(() => act(() => __limparToasts()));

function Montagem() {
  const [aberto, setAberto] = useState(true);
  return <><MenuRefeicao aberto={aberto} onFechar={() => setAberto(false)} nome="Café da Manhã" slot="cafe_da_manha" data="2026-11-05" entradas={[entrada(1), entrada(2)]} /><Toaster /></>;
}
function refeicao() {
  render(<Montagem />);
}

describe("menus", () => {
  it("copiar para amanhã copia só aquela refeição", async () => {
    refeicao();
    await userEvent.click(await screen.findByRole("button", { name: /Copiar para amanhã/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/diary/copy", { from_date: "2026-11-05", to_date: "2026-11-06", meal_slot: "cafe_da_manha" }));
  });

  it("apagar refeição apaga cada entrada e o desfazer recria pelo food_ref", async () => {
    refeicao();
    await userEvent.click(await screen.findByRole("button", { name: /Apagar refeição/ }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledTimes(2));
    await userEvent.click(await screen.findByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(api.post).toHaveBeenCalledWith("/diary", { entry_date: "2026-11-05", meal_slot: "cafe_da_manha", food_ref: "catalog:x1", quantity: 2, unit: "un" });
  });

  it("salvar como refeição pronta pede o nome e envia o slot e o dia", async () => {
    refeicao();
    await userEvent.click(await screen.findByRole("button", { name: /Salvar como refeição pronta/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/diary/saved-meals", { name: "Café da Manhã", entry_date: "2026-11-05", meal_slot: "cafe_da_manha" }));
  });

  it("menu do dia copia o dia inteiro para amanhã", async () => {
    render(<MenuDia aberto onFechar={() => {}} data="2026-11-05" day={null} />);
    await userEvent.click(await screen.findByRole("button", { name: /Copiar este dia para amanhã/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/diary/copy", { from_date: "2026-11-05", to_date: "2026-11-06" }));
  });
});
