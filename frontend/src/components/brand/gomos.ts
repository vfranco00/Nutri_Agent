/** Geometria dos gomos da fatia (viewBox 100 × 100). */
const RAD = Math.PI / 180;

function wedge(cx: number, cy: number, ri: number, ro: number, a0: number, a1: number): string {
  const p = (r: number, a: number) =>
    `${(cx + r * Math.cos(a * RAD)).toFixed(2)} ${(cy + r * Math.sin(a * RAD)).toFixed(2)}`;
  return `M${p(ri, a0)} L${p(ro, a0)} A${ro} ${ro} 0 0 1 ${p(ro, a1)} L${p(ri, a1)} A${ri} ${ri} 0 0 0 ${p(ri, a0)} Z`;
}

export const GOMOS = Array.from({ length: 8 }, (_, i) => {
  const a = i * 45 - 90;
  return wedge(50, 50, 6, 31, a + 5, a + 40);
});

/** Versão simplificada (gomos mais grossos) para a fatia pequena, como no pingo do logotipo. */
export const GOMOS_SIMPLES = Array.from({ length: 8 }, (_, i) => {
  const a = i * 45 - 90;
  return wedge(50, 50, 7, 33, a + 7, a + 38);
});
