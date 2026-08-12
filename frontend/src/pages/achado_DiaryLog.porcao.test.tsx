/**
 * Achado A-01 do relatório `docs/qa/relatorio-diario.md`.
 *
 * O formulário de porção abre com "100" fixo (`src/pages/DiaryLog.tsx:477`), qualquer que
 * seja a unidade base do alimento. Para um alimento de contagem (`base_unit: "un"`, ex.
 * ovo a 70 kcal/unidade) isso propõe **100 unidades** — 7.000 kcal — e o servidor aceita:
 * `quantity` só é barrada acima de 10.000 e o teto de plausibilidade do RS-10 só corta
 * acima de 20.000 kcal.
 *
 * O § 4.0 do ADR-0001 existe exatamente para impedir a confusão entre "por 100 g" e "por
 * unidade". Aqui ela reaparece no valor inicial de um campo.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { DiaryLog } from "./DiaryLog";
import { AlertProvider } from "../lib/AlertContext";
import { api } from "../lib/api";
import { makeDay, makeFood } from "../test/diaryFactories";
import { toIsoDate } from "../lib/diary";

vi.mock("../lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const HOJE = toIsoDate(new Date());

const OVO = makeFood({
  food_ref: "catalog:ovo-un",
  name: "Ovo",
  base_unit: "un",
  kcal_per_base_unit: 70,
  protein_per_base_unit: 6.3,
  carbs_per_base_unit: 0.4,
  fat_per_base_unit: 4.8,
  allowed_units: ["un", "fatia", "porcao"],
});

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
  vi.mocked(api.get).mockImplementation((url: string, cfg?: unknown) => {
    if (url === "/diary") {
      const date = (cfg as { params?: { date?: string } })?.params?.date ?? HOJE;
      return Promise.resolve({ data: makeDay({ date }) } as never);
    }
    if (url === "/diary/foods/search") {
      return Promise.resolve({ data: { results: [OVO], suggest_resolve: false } } as never);
    }
    return Promise.resolve({ data: [] } as never);
  });
});

describe("DiaryLog — quantidade inicial da porção", () => {
  it("alimento medido em UNIDADE não pode abrir o formulário com 100", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/diario"]}>
        <AlertProvider>
          <DiaryLog />
        </AlertProvider>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/buscar alimento/i), "ovo");
    const resultado = await screen.findByRole("button", { name: /Ovo/ }, { timeout: 3000 });
    await user.click(resultado);

    const campo = await screen.findByLabelText(/quantidade/i);
    await waitFor(() => expect(screen.getByLabelText(/unidade/i)).toHaveValue("un"));

    // 100 unidades de ovo = 7.000 kcal. O padrão razoável para unidade de contagem é 1.
    expect(campo).not.toHaveValue("100");
  });
});
