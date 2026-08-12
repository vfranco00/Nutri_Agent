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

  // A MESMA proteção para as mutações, que não a tinham.
  //
  // Sem isto, duas exclusões rápidas cujas respostas voltam fora de ordem faziam a
  // resposta da PRIMEIRA (que ainda continha a segunda entrada) chegar por último e
  // sobrescrever o estado: a entrada apagada reaparecia na tela e o total ficava errado
  // até recarregar. O contador do GET não cobria isso — ele só invalidava leituras.
  const mutacaoAtual = useRef(0);

  // Data cujo conteúdo já está na tela. Existe para honrar o "zero refetch" do D-6:
  // quando a resposta de uma mutação traz OUTRA data (§ 6.6 — um PATCH que muda
  // `entry_date` devolve o dia da data nova), o hook navega para ela, e sem esta marca
  // o `useEffect` refazia o GET da mesma data que o corpo da mutação acabou de entregar
  // — chamada extra e a lista piscando em esqueleto logo após uma edição bem-sucedida.
  const dataJaSatisfeita = useRef<string | null>(null);

  useEffect(() => {
    // O corpo de uma mutação já entregou este dia: buscar de novo seria refazer a
    // mesma pergunta que acabou de ser respondida.
    if (dataJaSatisfeita.current === date) return;

    const meuId = ++requisicaoAtual.current;
    let ativo = true;

    async function carregar() {
      setStatus("loading");
      setError(null);
      try {
        const res = await api.get<DiaryDay>("/diary", { params: { date } });
        if (!ativo || meuId !== requisicaoAtual.current) return;
        dataJaSatisfeita.current = date;
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

  // Recarregar é pedido explícito do usuário: invalida a marca para que o GET aconteça
  // mesmo que a data já esteja satisfeita.
  const reload = useCallback(() => {
    dataJaSatisfeita.current = null;
    setNonce((n) => n + 1);
  }, []);

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
    // Marca ANTES do setDate: é o que impede o efeito de refazer o GET da data que
    // este próprio corpo acabou de entregar.
    dataJaSatisfeita.current = novo.date;
    setDay(novo);
    setStatus("ready");
    setError(null);
    setDate(novo.date);
    return novo;
  }, []);

  /**
   * Executa uma mutação garantindo que só a resposta MAIS RECENTE vire estado.
   *
   * As três mutações passam por aqui porque o modo de falha é idêntico nas três: o
   * corpo devolvido é o dia INTEIRO recalculado (D-6), então uma resposta antiga
   * chegando por último não erra um campo — ela restaura o dia inteiro para como era
   * antes da operação seguinte.
   */
  const executarMutacao = useCallback(
    async (chamada: () => Promise<{ data: DiaryDay }>, mensagemDeErro: string) => {
      const meuId = ++mutacaoAtual.current;
      setMutating(true);
      try {
        const res = await chamada();
        // Obsoleta: outra mutação partiu depois desta. Quem chamou recebe o corpo,
        // mas ele NÃO substitui o que está na tela.
        if (meuId !== mutacaoAtual.current) return res.data;
        return aplicarResposta(res.data);
      } catch (err) {
        throw new Error(extractDiaryErrorMessage(err, mensagemDeErro));
      } finally {
        // Só a mais recente destrava os controles: uma resposta antiga não pode
        // reabilitar a interface enquanto a atual ainda está em voo.
        if (meuId === mutacaoAtual.current) setMutating(false);
      }
    },
    [aplicarResposta],
  );

  const addEntry = useCallback(
    (body: DiaryEntryCreate) =>
      executarMutacao(
        () => api.post<DiaryDay>("/diary", body),
        "Não foi possível registrar o alimento.",
      ),
    [executarMutacao],
  );

  const updateEntry = useCallback(
    (entryId: number, body: DiaryEntryUpdate) =>
      executarMutacao(
        () => api.patch<DiaryDay>(`/diary/${entryId}`, body),
        "Não foi possível salvar a alteração.",
      ),
    [executarMutacao],
  );

  const removeEntry = useCallback(
    (entryId: number) =>
      executarMutacao(
        // DELETE devolve 200 com o DiaryDay recalculado, não 204 (§ 6.7).
        () => api.delete<DiaryDay>(`/diary/${entryId}`),
        "Não foi possível apagar a entrada.",
      ),
    [executarMutacao],
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
