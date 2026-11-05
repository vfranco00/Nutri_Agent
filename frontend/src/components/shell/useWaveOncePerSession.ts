import { useEffect, useState } from "react";

const CHAVE = "nuvi_onda_logo";

let decisao: false | "once" | undefined;
let mostrada = false;

function decidir(): false | "once" {
  if (decisao !== undefined) return decisao;
  decisao = false;
  try {
    if (window.matchMedia?.("(display-mode: standalone)").matches) return decisao;
    if (sessionStorage.getItem(CHAVE)) return decisao;
    sessionStorage.setItem(CHAVE, "1");
    decisao = "once";
  } catch {
    // sem sessionStorage: sem onda
  }
  return decisao;
}

/** Só para os testes: volta ao estado de página recém-carregada. */
export function __resetWaveOnce(): void {
  decisao = undefined;
  mostrada = false;
}

/**
 * Na Web comum, o logo faz uma onda só por sessão (flag em sessionStorage), na
 * primeira montagem. No PWA instalado a abertura (Splash) já faz esse papel.
 * A decisão é tomada uma vez, então o StrictMode não a consome em dobro.
 */
export function useWaveOncePerSession(): false | "once" {
  const [onda] = useState<false | "once">(() => (mostrada ? false : decidir()));
  useEffect(() => {
    mostrada = true;
  }, []);
  return onda;
}
