import { api } from "./api";

/** Versão da política que o cadastro envia; precisa ser igual a `POLICY_VERSION` do backend. */
export const POLICY_VERSION_ACEITA = "2026-11-v1";

export type Purpose = "saude" | "ia" | "push" | "ranking" | "marketing";
export type ConsentSource = "cadastro" | "primeiro_uso" | "perfil";

export interface ConsentItem {
  purpose: Purpose;
  granted: boolean;
  at: string | null;
}
export interface ConsentState {
  policy_version: string;
  items: ConsentItem[];
}

export async function fetchConsents(): Promise<ConsentState> {
  const res = await api.get<ConsentState>("/consents/me");
  return res.data;
}

export async function saveConsent(purpose: Purpose, granted: boolean, source: ConsentSource): Promise<ConsentState> {
  const res = await api.post<ConsentState>("/consents/me", { purpose, granted, source });
  return res.data;
}

/** Se o erro é o `403 consent_required` da API, devolve a finalidade pedida; senão, null. */
export function consentRequiredPurpose(err: unknown): Purpose | null {
  const r = (err as { response?: { status?: number; data?: { detail?: unknown; purpose?: unknown } } })?.response;
  if (r?.status !== 403 || r.data?.detail !== "consent_required") return null;
  const p = r.data.purpose;
  return p === "ia" || p === "push" || p === "ranking" || p === "marketing" || p === "saude" ? p : null;
}

// ---- pedido de consentimento aberto pela tela (ConsentGate escuta) ----

type Pedido = { purpose: Purpose; resolve: (ok: boolean) => void };
let pedidoAtual: Pedido | null = null;
const ouvintes = new Set<(p: Purpose | null) => void>();

function avisar() {
  ouvintes.forEach((fn) => fn(pedidoAtual?.purpose ?? null));
}

export function subscribePedido(fn: (p: Purpose | null) => void): () => void {
  ouvintes.add(fn);
  fn(pedidoAtual?.purpose ?? null);
  return () => void ouvintes.delete(fn);
}

/** Abre a folha de consentimento e resolve com true (permitiu) ou false (agora não). */
export function requestConsent(purpose: Purpose): Promise<boolean> {
  if (pedidoAtual?.purpose === purpose) {
    return new Promise((resolve) => {
      const antigo = pedidoAtual!.resolve;
      pedidoAtual = { purpose, resolve: (ok) => { antigo(ok); resolve(ok); } };
    });
  }
  return new Promise((resolve) => {
    pedidoAtual = { purpose, resolve };
    avisar();
  });
}

export function resolverPedido(ok: boolean): void {
  const p = pedidoAtual;
  pedidoAtual = null;
  avisar();
  p?.resolve(ok);
}

/** Garante a finalidade: se já está concedida, true; senão abre a folha. */
export async function ensureConsent(purpose: Purpose): Promise<boolean> {
  try {
    const st = await fetchConsents();
    if (st.items.find((i) => i.purpose === purpose)?.granted) return true;
  } catch {
    /* sem resposta: pede mesmo assim; o servidor é quem decide */
  }
  return requestConsent(purpose);
}

// `403 consent_required` em qualquer chamada: pergunta ao usuário e, se ele permitir, repete a chamada.
api.interceptors?.response.use(
  (r) => r,
  async (error) => {
    const purpose = consentRequiredPurpose(error);
    const cfg = error?.config;
    if (!purpose || !cfg || cfg.__consentRetried) return Promise.reject(error);
    const ok = await requestConsent(purpose);
    if (!ok) return Promise.reject(error);
    cfg.__consentRetried = true;
    return api.request(cfg);
  },
);
