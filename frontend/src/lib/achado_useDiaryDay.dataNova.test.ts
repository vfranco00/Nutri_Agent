/**
 * Achado A-10 do relatório `docs/qa/relatorio-diario.md`.
 *
 * `PATCH` que muda `entry_date` devolve o `DiaryDay` da data NOVA (§ 6.6). O hook segue
 * a data (`setDate(novo.date)` em `src/lib/useDiaryDay.ts:97`), o que está correto — mas
 * mudar `date` dispara o `useEffect` do `GET` (`:54-78`), que refaz a chamada para a
 * mesma data que a resposta da mutação acabou de entregar.
 *
 * A decisão D-6 do ADR-0001 é literal: "Toda mutação devolve o DiaryDay recalculado — um
 * dono da aritmética, **zero refetch**". Além da chamada extra, o efeito coloca o estado
 * em `loading`, e a lista pisca em esqueleto depois de uma edição bem-sucedida.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { api } from "./api";
import { useDiaryDay } from "./useDiaryDay";
import { makeDay } from "../test/diaryFactories";

vi.mock("./api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const HOJE = "2026-08-11";
const ONTEM = "2026-08-10";

function getsDeDia(): string[] {
  return vi
    .mocked(api.get)
    .mock.calls.filter(([url]) => url === "/diary")
    .map(([, cfg]) => (cfg as { params?: { date?: string } } | undefined)?.params?.date ?? "");
}

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.patch).mockReset();
  vi.mocked(api.get).mockImplementation((url: string, cfg?: unknown) => {
    if (url === "/diary") {
      const date = (cfg as { params?: { date?: string } })?.params?.date ?? HOJE;
      return Promise.resolve({ data: makeDay({ date }) } as never);
    }
    return Promise.resolve({ data: [] } as never);
  });
});

describe("useDiaryDay — mutação que devolve outra data", () => {
  it("não refaz o GET da data que a própria resposta acabou de entregar", async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: makeDay({ date: ONTEM }) } as never);

    const { result } = renderHook(() => useDiaryDay(HOJE));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(getsDeDia()).toEqual([HOJE]);

    await act(async () => {
      await result.current.updateEntry(1, { entry_date: ONTEM });
    });

    await waitFor(() => expect(result.current.date).toBe(ONTEM));
    expect(result.current.day?.date).toBe(ONTEM);

    // D-6: zero refetch. O corpo do PATCH já é o dia de ONTEM.
    expect(getsDeDia()).toEqual([HOJE]);
  });
});
