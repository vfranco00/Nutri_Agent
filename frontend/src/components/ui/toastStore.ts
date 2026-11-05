import { useSyncExternalStore } from "react";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: number;
  message: string;
  action?: ToastAction;
  /** false enquanto sobe, true parado, "saindo" na descida. */
  fase: "entrando" | "visivel" | "saindo";
}

export const TOAST_DURACAO_MS = 4000;
export const TOAST_TRANSICAO_MS = 260;

let itens: ToastItem[] = [];
let proximo = 1;
const ouvintes = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>[]>();

function emitir() {
  ouvintes.forEach((l) => l());
}

function atualizar(id: number, fase: ToastItem["fase"]) {
  itens = itens.map((t) => (t.id === id ? { ...t, fase } : t));
  emitir();
}

function agendar(id: number, ms: number, fn: () => void) {
  const t = setTimeout(fn, ms);
  timers.set(id, [...(timers.get(id) ?? []), t]);
}

/** Fecha com a transição de saída e remove da lista. */
export function fecharToast(id: number) {
  const t = itens.find((x) => x.id === id);
  if (!t || t.fase === "saindo") return;
  atualizar(id, "saindo");
  agendar(id, TOAST_TRANSICAO_MS, () => {
    itens = itens.filter((x) => x.id !== id);
    (timers.get(id) ?? []).forEach(clearTimeout);
    timers.delete(id);
    emitir();
  });
}

/** Mostra um aviso que sobe de baixo (transição de 260 ms) e fica 4 s na tela. */
export function toast(message: string, opts?: { action?: ToastAction }): number {
  const id = proximo++;
  itens = [...itens, { id, message, action: opts?.action, fase: "entrando" }];
  emitir();
  agendar(id, 20, () => atualizar(id, "visivel"));
  agendar(id, TOAST_DURACAO_MS, () => fecharToast(id));
  return id;
}

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(
    (l) => {
      ouvintes.add(l);
      return () => ouvintes.delete(l);
    },
    () => itens,
  );
}

/** Só para os testes. */
export function __limparToasts(): void {
  timers.forEach((ts) => ts.forEach(clearTimeout));
  timers.clear();
  itens = [];
  emitir();
}
