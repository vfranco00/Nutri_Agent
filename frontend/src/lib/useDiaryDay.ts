import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { extractDiaryErrorMessage, isDayEmpty, shiftIsoDate, toIsoDate } from "./diary";
import type { DiaryDay, DiaryEntryCreate, DiaryEntryUpdate } from "../types";

export type DiaryStatus = "loading" | "ready" | "error";

export interface UseDiaryDayResult {
  /** Data em foco, 'YYYY-MM-DD'. */
  date: string;
  day: DiaryDay | null;
  status: DiaryStatus;
  /** Mensagem pronta para a tela. `null` quando não há erro. */
  error: string | null;
  /** Dia carregado, porém sem nada registrado nem planejado. */
  isEmpty: boolean;
  /** Alguma mutação em voo — desabilita os controles sem apagar a tela. */
  mutating: boolean;
  reload: () => void;
  goToDate: (iso: string) => void;
  shiftDay: (delta: number) => void;
  addEntry: (body: DiaryEntryCreate) => Promise<DiaryDay>;
  updateEntry: (entryId: number, body: DiaryEntryUpdate) => Promise<DiaryDay>;
  removeEntry: (entryId: number) => Promise<DiaryDay>;
}

/**
 * Estado do dia do diário.
 *
 * Duas regras do ADR-0001 moram aqui e não devem sair:
 *
 * - **D-6**: `POST`, `PATCH` e `DELETE` devolvem o `DiaryDay` inteiro
 *   recalculado. A resposta SUBSTITUI o estado. Nada de refetch, nada de
 *   recalcular total no cliente.
 * - **§ 6.6**: um `PATCH` que muda `entry_date` devolve o dia da data NOVA — a
 *   interface tem que navegar para ela, o que este hook faz sozinho lendo
 *   `resposta.date`.
 *
 * O projeto não usa React Query (§ 11): é `useState` + `useEffect`, como o
 * resto das telas.
 */
export function useDiaryDay(dataInicial?: string): UseDiaryDayResult {
  const [date, setDate] = useState(() => dataInicial ?? toIsoDate(new Date()));
  const [day, setDay] = useState<DiaryDay | null>(null);
  const [status, setStatus] = useState<DiaryStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [nonce, setNonce] = useState(0);

  // Protege contra resposta atrasada: trocar de dia duas vezes rápido não pode
  // deixar a resposta da primeira data sobrescrever a segunda.
  const requisicaoAtual = useRef(0);

  useEffect(() => {
    const meuId = ++requisicaoAtual.current;
    let ativo = true;

    async function carregar() {
      setStatus("loading");
      setError(null);
      try {
        const res = await api.get<DiaryDay>("/diary", { params: { date } });
        if (!ativo || meuId !== requisicaoAtual.current) return;
        setDay(res.data);
        setStatus("ready");
      } catch (err) {
        if (!ativo || meuId !== requisicaoAtual.current) return;
        setDay(null);
        setError(extractDiaryErrorMessage(err, "Não foi possível carregar o seu dia."));
        setStatus("error");
      }
    }

    carregar();
    return () => {
      ativo = false;
    };
  }, [date, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const goToDate = useCallback((iso: string) => {
    setDate(iso);
  }, []);

  const shiftDay = useCallback((delta: number) => {
    setDate((atual) => shiftIsoDate(atual, delta));
  }, []);

  /** Aplica o DiaryDay que a mutação devolveu e segue a data dele (§ 6.6). */
  const aplicarResposta = useCallback((novo: DiaryDay) => {
    // Invalida qualquer GET em voo: o corpo da mutação é mais recente que ele.
    requisicaoAtual.current += 1;
    setDay(novo);
    setStatus("ready");
    setError(null);
    setDate(novo.date);
    return novo;
  }, []);

  const addEntry = useCallback(
    async (body: DiaryEntryCreate) => {
      setMutating(true);
      try {
        const res = await api.post<DiaryDay>("/diary", body);
        return aplicarResposta(res.data);
      } catch (err) {
        throw new Error(extractDiaryErrorMessage(err, "Não foi possível registrar o alimento."));
      } finally {
        setMutating(false);
      }
    },
    [aplicarResposta],
  );

  const updateEntry = useCallback(
    async (entryId: number, body: DiaryEntryUpdate) => {
      setMutating(true);
      try {
        const res = await api.patch<DiaryDay>(`/diary/${entryId}`, body);
        return aplicarResposta(res.data);
      } catch (err) {
        throw new Error(extractDiaryErrorMessage(err, "Não foi possível salvar a alteração."));
      } finally {
        setMutating(false);
      }
    },
    [aplicarResposta],
  );

  const removeEntry = useCallback(
    async (entryId: number) => {
      setMutating(true);
      try {
        // DELETE devolve 200 com o DiaryDay recalculado, não 204 (§ 6.7).
        const res = await api.delete<DiaryDay>(`/diary/${entryId}`);
        return aplicarResposta(res.data);
      } catch (err) {
        throw new Error(extractDiaryErrorMessage(err, "Não foi possível apagar a entrada."));
      } finally {
        setMutating(false);
      }
    },
    [aplicarResposta],
  );

  return {
    date,
    day,
    status,
    error,
    isEmpty: day !== null && isDayEmpty(day),
    mutating,
    reload,
    goToDate,
    shiftDay,
    addEntry,
    updateEntry,
    removeEntry,
  };
}
