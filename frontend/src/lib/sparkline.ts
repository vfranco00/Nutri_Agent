export interface Sparkline {
  /** `d` do <path>. */
  path: string;
  /** Ponto final, para o círculo de destaque. */
  lastX: number;
  lastY: number;
  first: number;
  last: number;
  /** last - first. Negativo = perdeu peso. */
  delta: number;
}

/**
 * Sparkline do mini-card de peso (Opção 1).
 *
 * Geometria pura: recebe os valores na ordem cronológica e devolve o caminho
 * SVG. `null` com menos de dois pontos — uma linha de um ponto só não é
 * tendência, e desenhar uma reta reta sugeriria estabilidade que ninguém mediu.
 */
export function buildSparkline(values: number[], width = 120, height = 36): Sparkline | null {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const amplitude = max - min;

  const pontos = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    // Sem variação nenhuma, a linha fica no meio da caixa em vez de dividir por zero.
    const y = amplitude === 0 ? height / 2 : height - ((v - min) / amplitude) * height;
    return { x, y };
  });

  const path = pontos
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  const first = values[0];
  const last = values[values.length - 1];

  return {
    path,
    lastX: pontos[pontos.length - 1].x,
    lastY: pontos[pontos.length - 1].y,
    first,
    last,
    delta: Math.round((last - first) * 10) / 10,
  };
}
