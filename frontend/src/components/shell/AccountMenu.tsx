import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, MessageCircleQuestion, Moon, Sun } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { useFeedback } from "../../lib/FeedbackContext";
import { ROUTES } from "../../routes";

const LINKS: Array<[string, string]> = [
  ["Perfil e metas", ROUTES.perfil],
  ["Progresso", ROUTES.progresso],
  ["Meus alimentos", ROUTES.alimentos],
  ["Lembretes", ROUTES.lembretes],
  ["Assinatura", ROUTES.assinatura],
];

/** Menu da conta (avatar) do cabeçalho do celular. */
export function AccountMenu({ isDark, toggleTheme }: { isDark: boolean; toggleTheme: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { openFeedbackModal } = useFeedback();
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const inicial = (user?.full_name || user?.email || "N").trim().charAt(0).toUpperCase();

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        aria-label="Conta"
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-act-soft text-base font-black text-act-text"
      >
        {inicial}
      </button>
      {aberto && (
        <div role="menu" className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-line bg-card p-1.5 shadow-lg">
          {LINKS.map(([nome, to]) => (
            <Link key={to} to={to} role="menuitem" onClick={() => setAberto(false)} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-ink hover:bg-soft">
              {nome}
            </Link>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setAberto(false);
              openFeedbackModal();
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink hover:bg-soft"
          >
            <MessageCircleQuestion className="h-4 w-4" aria-hidden="true" />
            Ajuda e sugestões
          </button>
          <button type="button" role="menuitem" onClick={toggleTheme} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink hover:bg-soft">
            {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
            {isDark ? "Modo claro" : "Modo escuro"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-soft dark:text-red-400"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
