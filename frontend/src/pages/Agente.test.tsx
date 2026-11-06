import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Agente } from "./Agente";
import { api } from "../lib/api";
import { Toaster } from "../components/ui/Toast";
import type { AgentParseResponse, FoodOption } from "../types";

vi.mock("../lib/api", () => ({ api: { get: vi.fn(), post: vi.fn() } }));

const food = (ref: string, name: string, k: number, base: "g" | "un" = "un"): FoodOption => ({
  food_ref: ref,
  name,
  base_unit: base,
  kcal_per_base_unit: k,
  protein_per_base_unit: null,
  carbs_per_base_unit: null,
  fat_per_base_unit: null,
  allowed_units: base === "un" ? ["un", "porcao"] : ["g", "porcao"],
  source: "taco",
  is_estimate: false,
});

const RESPOSTA: AgentParseResponse = {
  date: "2026-11-05",
  meal_slot: "almoco",
  items: [
    { name: "ovo", food: food("catalog:ovo", "Ovo cozido", 78), quantity: 2, unit: "un", confidence: "alta", alternatives: [] },
    { name: "molho", food: null, quantity: 1, unit: "porcao", confidence: "baixa", alternatives: [] },
  ],
};

function Local() {
  const l = useLocation();
  return <div data-testid="local">{l.pathname + l.search}</div>;
}
function montar() {
  return render(
    <MemoryRouter initialEntries={["/agente"]}>
      <Routes>
        <Route path="/agente" element={<><Agente /><Local /><Toaster /></>} />
        <Route path="*" element={<Local />} />
      </Routes>
    </MemoryRouter>,
  );
}
async function enviar(texto: string) {
  await userEvent.type(screen.getByLabelText("Mensagem para o Agente"), texto);
  await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
}

beforeEach(() => {
  vi.mocked(api.post).mockReset();
});

describe("Agente", () => {
  it("mostra o cartão 'Anotei no almoço' com Confirmar e Ajustar", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: RESPOSTA });
    montar();
    await enviar("comi 2 ovos");
    expect(await screen.findByText(/Anotei no almoço/)).toBeInTheDocument();
    expect(screen.getByText(/Ovo cozido/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ajustar" })).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith("/agent/parse", expect.objectContaining({ text: "comi 2 ovos" }));
  });

  it("Confirmar grava só o item da alta e depois mostra Registrado", async () => {
    vi.mocked(api.post).mockImplementation((url: string) =>
      Promise.resolve({ data: url === "/agent/parse" ? RESPOSTA : {} }),
    );
    montar();
    await enviar("comi 2 ovos");
    await userEvent.click(await screen.findByRole("button", { name: "Confirmar" }));
    await screen.findByText(/Registrado/);
    const diario = vi.mocked(api.post).mock.calls.filter(([u]) => u === "/diary");
    expect(diario).toHaveLength(1);
    expect(diario[0][1]).toMatchObject({ food_ref: "catalog:ovo", quantity: 2, unit: "un", meal_slot: "almoco" });
    expect((diario[0][1] as { entry_date: string }).entry_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("429 mostra a mensagem do plano com link para a assinatura e mantém o texto", async () => {
    vi.mocked(api.post).mockRejectedValue({
      response: { status: 429, data: { detail: { code: "PLAN_LIMIT_REACHED", message: "Acabaram as leituras de hoje.", upgrade_url: "/assinatura" } } },
    });
    montar();
    await enviar("comi arroz");
    expect(await screen.findByText("Acabaram as leituras de hoje.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver planos/ })).toHaveAttribute("href", "/assinatura");
    expect(screen.getByLabelText("Mensagem para o Agente")).toHaveValue("comi arroz");
  });

  it("item de baixa sem alimento mostra Buscar e não entra no Confirmar", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: RESPOSTA });
    montar();
    await enviar("comi 2 ovos");
    await screen.findByText(/Anotei no almoço/);
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(screen.getByTestId("local").textContent).toMatch(/^\/registrar\?/);
  });

  it("enquanto espera, depois de 300 ms aparece o mascote com nuvi-wave", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let resolver!: (v: unknown) => void;
    vi.mocked(api.post).mockReturnValue(new Promise((r) => (resolver = r)) as never);
    montar();
    await enviar("comi 2 ovos");
    expect(document.querySelector(".nuvi-wave")).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(350);
    });
    expect(document.querySelector(".nuvi-wave")).not.toBeNull();
    await act(async () => resolver({ data: RESPOSTA }));
    await waitFor(() => expect(document.querySelector(".nuvi-wave")).toBeNull());
    vi.useRealTimers();
  });

  it("403 de consentimento recusado mostra o aviso do Perfil > Privacidade", async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 403, data: { detail: "consent_required", purpose: "ia" } } });
    montar();
    await enviar("comi arroz");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Perfil > Privacidade/));
  });
});
