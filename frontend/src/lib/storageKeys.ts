/** Chaves do navegador. Antes do Nuvi elas começavam com `nutri_`. */
export const TOKEN_KEY = "nuvi_token";
export const PLAN_KEY = "nuvi_current_plan";
export const EXPIRY_BANNER_KEY = "nuvi_expiry_banner_dismissed";

const ANTIGAS: Array<[string, string]> = [
  ["nutri_token", TOKEN_KEY],
  ["nutri_current_plan", PLAN_KEY],
  ["nutri_expiry_banner_dismissed", EXPIRY_BANNER_KEY],
];

/** Move as chaves `nutri_*` para `nuvi_*`, para ninguém ser deslogado na troca de nome. */
export function migrarChavesAntigas(storage: Storage = localStorage): void {
  try {
    for (const [antiga, nova] of ANTIGAS) {
      const v = storage.getItem(antiga);
      if (v !== null && storage.getItem(nova) === null) storage.setItem(nova, v);
      if (v !== null) storage.removeItem(antiga);
    }
  } catch {
    // navegador sem localStorage (aba privada etc.): segue sem migrar
  }
}
