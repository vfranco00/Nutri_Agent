import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { NuviSlice } from "./brand/NuviSlice";
import { deslocamentoDoArrasto, gomosAcesos, PTR_GATILHO, PTR_SEGURA } from "../lib/puxar";

function paiRolavel(el: HTMLElement | null): HTMLElement | null {
  let atual = el?.parentElement ?? null;
  while (atual) {
    const o = getComputedStyle(atual).overflowY;
    if (o === "auto" || o === "scroll") return atual;
    atual = atual.parentElement;
  }
  return null;
}

/**
 * Puxar para atualizar (docs/design/12-animacoes.html, seção 4). Só com o dedo (toque):
 * a cada 12 px acende um gomo, só por opacidade; com 96 px ou mais, soltar chama
 * `onRefresh()` e mostra a onda até a promise resolver; soltar antes volta em 320 ms.
 */
export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<unknown> | void; children: ReactNode }) {
  const raiz = useRef<HTMLDivElement>(null);
  const icone = useRef<HTMLDivElement>(null);
  const inicioY = useRef<number | null>(null);
  const deslocRef = useRef(0);
  const ocupadoRef = useRef(false);
  const [atualizando, setAtualizando] = useState(false);
  const [solto, setSolto] = useState(false);

  const aplicar = useCallback((d: number) => {
    deslocRef.current = d;
    if (raiz.current) raiz.current.style.transform = d > 0 ? `translateY(${d}px)` : "";
    if (icone.current) {
      const n = gomosAcesos(d);
      const ocupado = ocupadoRef.current;
      icone.current.style.opacity = d > 0 ? "1" : "0";
      icone.current
        .querySelectorAll<SVGPathElement>(".nuvi-gomo")
        .forEach((g, i) => (g.style.opacity = ocupado ? "" : i < n ? "1" : "0.12"));
    }
  }, []);

  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const scroller = () => paiRolavel(el);

    function inicio(e: TouchEvent) {
      if (atualizando) return;
      const s = scroller();
      if ((s?.scrollTop ?? window.scrollY) > 0) return;
      inicioY.current = e.touches[0].clientY;
      setSolto(false);
    }
    function mover(e: TouchEvent) {
      if (inicioY.current === null) return;
      const delta = e.touches[0].clientY - inicioY.current;
      if (delta <= 0) {
        aplicar(0);
        return;
      }
      aplicar(deslocamentoDoArrasto(delta));
    }
    async function fim() {
      if (inicioY.current === null) return;
      inicioY.current = null;
      const d = deslocRef.current;
      setSolto(true);
      if (d >= PTR_GATILHO) {
        // Segura em 56 px, com a onda, até a promise resolver.
        ocupadoRef.current = true;
        aplicar(PTR_SEGURA);
        setAtualizando(true);
        try {
          await onRefresh();
        } finally {
          ocupadoRef.current = false;
          setAtualizando(false);
          aplicar(0);
        }
      } else {
        aplicar(0);
      }
    }
    el.addEventListener("touchstart", inicio, { passive: true });
    el.addEventListener("touchmove", mover, { passive: true });
    el.addEventListener("touchend", fim);
    el.addEventListener("touchcancel", fim);
    return () => {
      el.removeEventListener("touchstart", inicio);
      el.removeEventListener("touchmove", mover);
      el.removeEventListener("touchend", fim);
      el.removeEventListener("touchcancel", fim);
    };
  }, [aplicar, atualizando, onRefresh]);

  return (
    <div className="relative">
      <div
        ref={icone}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-12 flex h-12 items-center justify-center opacity-0"
      >
        <NuviSlice size={32} wave={atualizando} />
      </div>
      <div
        ref={raiz}
        style={{ transition: solto ? "transform 320ms var(--ease-out)" : "none" }}
        className="motion-reduce:!transition-none"
      >
        {children}
      </div>
      <span aria-live="polite" className="sr-only">
        {atualizando ? "Atualizando." : ""}
      </span>
    </div>
  );
}
