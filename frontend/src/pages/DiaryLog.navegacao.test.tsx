/**
 * Regressão: as setas de dia anterior / próximo dia do "Registrar alimentação".
 *
 * Defeito relatado em produção: clicar em qualquer das duas setas não mudava o dia — a
 * tela continuava no mesmo. O `DiaryLog` mantém a data em DOIS lugares (o estado interno
 * de `useDiaryDay` e o parâmetro `?date=` da URL), e é a interação entre eles que está
 * sob teste aqui.
 *
 * O teste observa a CHAMADA À API, não o texto na tela: é `GET /diary?date=` que prova
 * que o dia realmente mudou. Um rótulo pode mudar sozinho sem os dados acompanharem.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { DiaryLog } from "./DiaryLog";
import { AlertProvider } from "../lib/AlertContext";
import { api } from "../lib/api";
import { makeDay } from "../test/diaryFactories";
import { toIsoDate, shiftIsoDate } from "../lib/diary";

vi.mock("../lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const HOJE = toIsoDate(new Date());

/** Devolve as datas pedidas em GET /diary, na ordem. */
function datasPedidas(): string[] {
  return vi
    .mocked(api.get)
    .mock.calls.filter(([url]) => url === "/diary")
    .map(([, cfg]) => (cfg as { params?: { date?: string } } | undefined)?.params?.date ?? "");
}

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.get).mockImplementation((url: string, cfg?: unknown) => {
    if (url === "/diary") {
      const date = (cfg as { params?: { date?: string } })?.params?.date ?? HOJE;
      // O backend ecoa a data pedida — é assim que o dia composto é devolvido.
      return Promise.resolve({ data: makeDay({ date }) } as never);
    }
    return Promise.resolve({ data: [] } as never);
  });
});

function renderDiary() {
  return render(
    <MemoryRouter initialEntries={["/diario"]}>
      <AlertProvider>
        <DiaryLog />
      </AlertProvider>
    </MemoryRouter>,
  );
}

describe("DiaryLog — navegação de dia", () => {
  it("abre no dia de hoje", async () => {
    renderDiary();
    await waitFor(() => expect(datasPedidas()).toContain(HOJE));
  });

  it("a seta esquerda busca o dia ANTERIOR", async () => {
    const user = userEvent.setup();
    renderDiary();
    await waitFor(() => expect(datasPedidas().length).toBeGreaterThan(0));

    await user.click(screen.getByRole("button", { name: "Dia anterior" }));

    const ontem = shiftIsoDate(HOJE, -1);
    await waitFor(() => expect(datasPedidas()).toContain(ontem));
  });

  it("a seta direita busca o PRÓXIMO dia", async () => {
    const user = userEvent.setup();
    renderDiary();
    await waitFor(() => expect(datasPedidas().length).toBeGreaterThan(0));

    await user.click(screen.getByRole("button", { name: "Próximo dia" }));

    const amanha = shiftIsoDate(HOJE, 1);
    await waitFor(() => expect(datasPedidas()).toContain(amanha));
  });

  it("dois cliques seguidos andam DOIS dias, não um", async () => {
    // O caso que um estado duplicado quebra: o segundo clique parte do valor que a URL
    // devolveu, não do que o usuário acabou de escolher, e a data fica presa.
    const user = userEvent.setup();
    renderDiary();
    await waitFor(() => expect(datasPedidas().length).toBeGreaterThan(0));

    const anterior = screen.getByRole("button", { name: "Dia anterior" });
    await user.click(anterior);
    await waitFor(() => expect(datasPedidas()).toContain(shiftIsoDate(HOJE, -1)));
    await user.click(anterior);

    await waitFor(() => expect(datasPedidas()).toContain(shiftIsoDate(HOJE, -2)));
  });

  it("o rótulo do cabeçalho acompanha o dia buscado", async () => {
    const user = userEvent.setup();
    renderDiary();
    await waitFor(() => expect(datasPedidas().length).toBeGreaterThan(0));

    await user.click(screen.getByRole("button", { name: "Dia anterior" }));

    await waitFor(() => expect(screen.getByText(/Ontem/)).toBeInTheDocument());
  });

  it("o botão Hoje volta para o dia atual", async () => {
    const user = userEvent.setup();
    renderDiary();
    await waitFor(() => expect(datasPedidas().length).toBeGreaterThan(0));

    await user.click(screen.getByRole("button", { name: "Dia anterior" }));
    await waitFor(() => expect(datasPedidas()).toContain(shiftIsoDate(HOJE, -1)));

    await user.click(screen.getByRole("button", { name: "Hoje" }));

    await waitFor(() => {
      const pedidas = datasPedidas();
      expect(pedidas[pedidas.length - 1]).toBe(HOJE);
    });
  });
});
