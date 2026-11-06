import { movimentoReduzido } from "./useReducedMotion";

/** Gomos giram de 0 a 52° e voltam a 45° (640 ms, --ease-out). Sem giro com movimento reduzido. */
export function girarGomos(svg: SVGElement | null) {
  const g = svg?.querySelector<SVGGElement>(":scope > g:not(.nuvi-face)");
  if (!g || movimentoReduzido() || typeof g.animate !== "function") return;
  g.style.transformBox = "view-box";
  g.style.transformOrigin = "50px 50px";
  g.animate(
    [{ transform: "rotate(0deg)" }, { transform: "rotate(52deg)", offset: 0.7 }, { transform: "rotate(45deg)" }],
    { duration: 640, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
  );
}
