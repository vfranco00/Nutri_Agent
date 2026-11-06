import { api } from "./api";
import { ensureConsent } from "./consents";

export type ResultadoPush = "ok" | "negado" | "indisponivel" | "nao_configurado" | "sem_consentimento";

export function pushSuportado(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function chaveParaBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Pede consentimento e permissão, assina com a chave VAPID e envia a inscrição ao servidor. */
export async function ativarPush(): Promise<ResultadoPush> {
  if (!pushSuportado()) return "indisponivel";
  if (!(await ensureConsent("push"))) return "sem_consentimento";
  if (Notification.permission === "denied") return "negado";
  const permissao = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permissao !== "granted") return "negado";
  let chave: string;
  try {
    chave = (await api.get<{ public_key: string }>("/push/vapid-public-key")).data.public_key;
  } catch {
    return "nao_configurado";
  }
  await navigator.serviceWorker.register("/sw.js");
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chave) }));
  await api.post("/push/subscriptions", sub.toJSON());
  return "ok";
}

/** Já existe inscrição neste aparelho? */
export async function pushAtivoNesteAparelho(): Promise<boolean> {
  if (!pushSuportado() || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  return !!(await reg?.pushManager.getSubscription());
}
