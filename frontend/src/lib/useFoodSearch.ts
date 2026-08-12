import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { extractDiaryErrorMessage } from "./diary";
import type { DiaryUnit, FoodOption, FoodSearchResponse } from "../types";

/**
 * RS-24: `GET /diary/foods/search` tem rate limit de 30/minuto, e o ADR exige
 * debounce **≥ 300 ms** no cliente. 350 ms deixa margem sem parecer travado.
 * Baixar disto reintroduz o estouro de cota que o requisito existe para evitar.
 */
export const SEARCH_DEBOUNCE_MS = 350;

/** RS-15: `q` tem `min_length=2` depois do `.strip()`. Abaixo disso o servidor
 *  devolve 422 — não vale gastar chamada. */
export const SEARCH_MIN_LENGTH = 2;

/** RS-15: `max_length=60`. O input trava aqui em vez de tomar 422. */
export const SEARCH_MAX_LENGTH = 60;

export type FoodSearchStatus = "idle" | "searching" | "ready" | "error";

export interface UseFoodSearchResult {
  term: string;
  setTerm: (t: string) => void;
  status: FoodSearchStatus;
  results: FoodOption[];
  /** § 6.1: vem `true` só quando `results` está vazio. Gatilho do "Estimar com IA". */
  suggestResolve: boolean;
  error: string | null;
  resolving: boolean;
  /** Único caminho pago (§ 6.2). Só dispara por ação explícita do usuário. */
  resolveWithAi: (unit: DiaryUnit) => Promise<FoodOption>;
  clear: () => void;
}

export function useFoodSearch(): UseFoodSearchResult {
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState<FoodSearchStatus>("idle");
  const [results, setResults] = useState<FoodOption[]>([]);
  const [suggestResolve, setSuggestResolve] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const requisicaoAtual = useRef(0);

  useEffect(() => {
    const limpo = term.trim();

    if (limpo.length < SEARCH_MIN_LENGTH) {
      // Invalida qualquer busca em voo: apagar o campo tem que limpar a lista
      // mesmo que a resposta anterior ainda esteja a caminho.
      requisicaoAtual.current += 1;
      setStatus("idle");
      setResults([]);
      setSuggestResolve(false);
      setError(null);
      return;
    }

    setStatus("searching");
    setError(null);

    const timer = setTimeout(async () => {
      const meuId = ++requisicaoAtual.current;
      try {
        const res = await api.get<FoodSearchResponse>("/diary/foods/search", {
          params: { q: limpo },
        });
        if (meuId !== requisicaoAtual.current) return;
        setResults(res.data.results ?? []);
        setSuggestResolve(Boolean(res.data.suggest_resolve));
        setStatus("ready");
      } catch (err) {
        if (meuId !== requisicaoAtual.current) return;
        setResults([]);
        setSuggestResolve(false);
        setError(extractDiaryErrorMessage(err, "Não foi possível buscar agora."));
        setStatus("error");
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [term]);

  const resolveWithAi = useCallback(
    async (unit: DiaryUnit) => {
      const limpo = term.trim();
      setResolving(true);
      setError(null);
      try {
        const res = await api.post<FoodOption>("/diary/foods/resolve", {
          name: limpo,
          unit,
        });
        return res.data;
      } catch (err) {
        throw new Error(
          extractDiaryErrorMessage(err, "Não foi possível estimar esse alimento agora."),
        );
      } finally {
        setResolving(false);
      }
    },
    [term],
  );

  const clear = useCallback(() => {
    requisicaoAtual.current += 1;
    setTerm("");
    setResults([]);
    setSuggestResolve(false);
    setStatus("idle");
    setError(null);
  }, []);

  return {
    term,
    setTerm,
    status,
    results,
    suggestResolve,
    error,
    resolving,
    resolveWithAi,
    clear,
  };
}
