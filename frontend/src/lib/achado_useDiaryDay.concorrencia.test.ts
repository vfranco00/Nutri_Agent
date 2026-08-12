/**
 * Achado A-02 do relatório `docs/qa/relatorio-diario.md`.
 *
 * Duas exclusões rápidas, respostas fora de ordem: a entrada apagada volta para a tela.
 *
 * `aplicarResposta` (`src/lib/useDiaryDay.ts:91-99`) aplica o corpo de TODA mutação sem
 * checar se ela ainda é a mais recente. Ela incrementa `requisicaoAtual.current` para
 * invalidar um `GET` em voo, mas nenhuma mutação consulta esse contador — o guard existe
 * só dentro do `useEffect` do `GET`. Basta a resposta do primeiro `DELETE` chegar depois
 * da do segundo para o estado voltar a um dia que já não existe.
 *
 * O `DiaryLog` também não desabilita o botão de apagar durante a mutação
 * (`src/pages/DiaryLog.tsx:679-686`), então disparar as duas exclusões é trivial.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { api } from "./api";
import { useDiaryDay } from "./useDiaryDay";
import { makeDay, makeEntry, makeSlot } from "../test/diaryFactories";
import { MEAL_SLOT_ORDER, type DiaryDay } from "../types";

vi.mock("./api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const DATA = "2026-08-11";

/** Dia com as entradas informadas, todas no almoço, 100 kcal cada. */
function diaCom(ids: number[]): DiaryDay {
  const entries = ids.map((id) =>
    makeEntry({ id, meal_slot: "almoco", food_name: `Alimento ${id}`, calories_total: 100 }),
  );
  return makeDay({
    date: DATA,
    entries_count: entries.length,
    totals: { calories: 100 * entries.length, protein_g: null, carbs_g: null, fat_g: null },
    slots: MEAL_SLOT_ORDER.map((s) =>
      makeSlot(s, s === "almoco" ? { entries, logged_calories: 100 * entries.length } : {}),
    ),
  });
}

function idsNaTela(day: DiaryDay | null): number[] {
  return (day?.slots ?? []).flatMap((s) => s.entries.map((e) => e.id));
}

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.delete).mockReset();
  vi.mocked(api.get).mockResolvedValue({ data: diaCom([1, 2]) } as never);
});

describe("useDiaryDay — duas exclusões concorrentes", () => {
  it("a resposta atrasada da PRIMEIRA exclusão não pode ressuscitar a segunda entrada", async () => {
    let responderPrimeira!: (v: unknown) => void;
    let responderSegunda!: (v: unknown) => void;

    vi.mocked(api.delete)
      .mockImplementationOnce(
        () => new Promise((resolve) => { responderPrimeira = resolve; }) as never,
      )
      .mockImplementationOnce(
        () => new Promise((resolve) => { responderSegunda = resolve; }) as never,
      );

    const { result } = renderHook(() => useDiaryDay(DATA));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(idsNaTela(result.current.day)).toEqual([1, 2]);

    // O usuário clica na lixeira de 1 e, sem esperar, na lixeira de 2.
    act(() => {
      void result.current.removeEntry(1).catch(() => undefined);
    });
    act(() => {
      void result.current.removeEntry(2).catch(() => undefined);
    });

    // A resposta da SEGUNDA exclusão chega primeiro: o dia já não tem nenhuma das duas.
    await act(async () => {
      responderSegunda({ data: diaCom([]) });
      await Promise.resolve();
    });
    expect(idsNaTela(result.current.day)).toEqual([]);

    // A resposta da PRIMEIRA chega atrasada, carregando o estado do servidor no momento
    // em que ele processou aquele DELETE: a entrada 2 ainda existia.
    await act(async () => {
      responderPrimeira({ data: diaCom([2]) });
      await Promise.resolve();
    });

    expect(idsNaTela(result.current.day)).not.toContain(2);
    expect(result.current.day?.totals.calories).toBe(0);
  });
});
