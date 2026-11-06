import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Progresso } from "./Progresso";
import { pontosDoGrafico } from "../lib/progresso";
import { AlertProvider } from "../lib/AlertContext";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === "/profiles/weight/history") {
      return Promise.resolve({
        data: [
          { date: "2026-09-01", weight: 75 },
          { date: "2026-11-04", weight: 71.4 },
        ],
      } as never);
    }
    return Promise.reject(new Error("sem resumo"));
  });
});

function renderTela() {
  return render(
    <MemoryRouter>
      <AlertProvider>
        <Progresso />
      </AlertProvider>
    </MemoryRouter>,
  );
}

describe("Progresso", () => {
  it("mostra o peso atual, a variação e o botão Registrar peso", async () => {
    renderTela();
    expect(await screen.findByText("71,4")).toBeInTheDocument();
    expect(screen.getByText(/−3,6 kg desde a primeira pesagem/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar peso" })).toBeInTheDocument();
  });

  it("registra o peso digitado e o mostra como atual", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValue({ data: { date: "2026-11-05", weight: 71.2 } } as never);
    renderTela();
    await user.click(await screen.findByRole("button", { name: "Registrar peso" }));
    await user.type(await screen.findByLabelText(/Peso de hoje/), "71,2");
    await user.click(screen.getByRole("button", { name: "Salvar peso" }));

    expect(api.post).toHaveBeenCalledWith("/profiles/weight", { weight: 71.2 });
    expect(await screen.findByText("71,2")).toBeInTheDocument();
  });

  it("o gráfico põe o mais pesado no alto e o mais leve embaixo", () => {
    const [a, b] = pontosDoGrafico([75, 71]);
    expect(a.y).toBeLessThan(b.y);
  });
});
