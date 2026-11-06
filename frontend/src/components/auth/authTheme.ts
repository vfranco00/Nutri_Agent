import { useEffect } from "react";

/** Liga ou desliga o tema escuro nas telas públicas, como a casca do app faz (`localStorage.theme`). */
export function useAuthTheme(): boolean {
  let dark = false;
  try {
    const saved = localStorage.getItem("theme");
    dark = saved === "dark" || (!saved && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  } catch {
    dark = false;
  }
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  return dark;
}

/** Campo de texto das telas públicas (creme, cartão branco, foco laranja-texto). */
export const AUTH_CAMPO =
  "w-full rounded-2xl border border-line bg-bg py-3 pl-11 pr-4 text-sm text-ink placeholder:text-mut focus-visible:outline-2 focus-visible:outline-act-text";
export const AUTH_CAMPO_SENHA = AUTH_CAMPO.replace("pr-4", "pr-11");
export const AUTH_ROTULO = "ml-1 text-xs font-bold text-mut";
export const AUTH_ICONE = "absolute left-3.5 top-3 h-5 w-5 text-mut";
export const AUTH_ERRO = "rounded-2xl bg-act-soft px-4 py-3 text-center text-sm font-semibold text-ink";
export const AUTH_LINK = "font-extrabold text-act-text hover:underline";
