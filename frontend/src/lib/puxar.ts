// Medidas do puxar para atualizar (docs/design/12-animacoes.html, seção 4).
export const PTR_MAX = 112;
export const PTR_GATILHO = 96;
export const PTR_PASSO = 12;
export const PTR_SEGURA = 56;

/** Quantos gomos acendem para um deslocamento (um a cada 12 px, no máximo 8). */
export function gomosAcesos(deslocamento: number): number {
  return Math.min(8, Math.floor(Math.max(0, deslocamento) / PTR_PASSO));
}

/** O arrasto segue o dedo com metade da distância, até 112 px. */
export function deslocamentoDoArrasto(deltaDedo: number): number {
  return Math.min(PTR_MAX, Math.max(0, deltaDedo) / 2);
}
