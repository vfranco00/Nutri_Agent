import { useCallback, useEffect, useRef } from "react";
import type { UseDiaryDayResult } from "./useDiaryDay";

/**
 * Transforma o `reload()` do diário numa promise que resolve quando o dia termina de
 * recarregar (carregou ou falhou) — é o que o PullToRefresh espera para parar a onda.
 */
export function useAtualizarDia(diary: Pick<UseDiaryDayResult, "status" | "reload">) {
  const espera = useRef<{ resolve: () => void; viuCarregando: boolean } | null>(null);

  useEffect(() => {
    const e = espera.current;
    if (!e) return;
    if (diary.status === "loading") e.viuCarregando = true;
    else if (e.viuCarregando) {
      espera.current = null;
      e.resolve();
    }
  }, [diary.status]);

  return useCallback(
    () =>
      new Promise<void>((resolve) => {
        espera.current = { resolve, viuCarregando: false };
        diary.reload();
        // Rede de segurança: nunca prende a onda para sempre.
        setTimeout(() => {
          if (espera.current?.resolve === resolve) {
            espera.current = null;
            resolve();
          }
        }, 10000);
      }),
    [diary],
  );
}
