/** Pontos da linha do gráfico (viewBox 300 × 130), do mais leve ao mais pesado. */
export function pontosDoGrafico(valores: number[]): Array<{ x: number; y: number }> {
  if (valores.length === 0) return [];
  const max = Math.max(...valores);
  const min = Math.min(...valores);
  const amp = max - min || 1;
  return valores.map((v, i) => ({
    x: valores.length === 1 ? 150 : i * (300 / (valores.length - 1)),
    y: ((max - v) / amp) * 110 + 10,
  }));
}
