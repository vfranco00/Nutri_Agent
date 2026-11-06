/** Movimento reduzido ligado no sistema? (seguro fora do navegador e no jsdom) */
export function movimentoReduzido(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}
