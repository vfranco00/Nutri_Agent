import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, MessageCircleHeart, NotebookPen, Plus, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { openRegistrar, ROUTES } from "../../routes";

interface Aba {
  nome: string;
  to: string;
  icon: LucideIcon;
  /** Prefixos de rota em que a aba aparece ativa. */
  ativa: string[];
}

const ESQUERDA: Aba[] = [
  { nome: "Hoje", to: ROUTES.hoje, icon: Home, ativa: [ROUTES.hoje] },
  { nome: "Diário", to: ROUTES.diario, icon: NotebookPen, ativa: [ROUTES.diario] },
];
const DIREITA: Aba[] = [
  {
    nome: "Cardápio",
    to: ROUTES.cardapios,
    icon: UtensilsCrossed,
    ativa: [ROUTES.cardapios, ROUTES.compras, ROUTES.receitas, ROUTES.chef, ROUTES.comunidade],
  },
  { nome: "Agente", to: ROUTES.agente, icon: MessageCircleHeart, ativa: [ROUTES.agente] },
];

function Tab({ aba, pathname }: { aba: Aba; pathname: string }) {
  const ativa = aba.ativa.some((p) => pathname === p || pathname.startsWith(p + "/"));
  return (
    <NavLink
      to={aba.to}
      aria-current={ativa ? "page" : undefined}
      className={`flex w-14 flex-col items-center gap-[3px] text-[10.5px] font-bold active:scale-[.97] ${
        ativa ? "text-bar-on" : "text-bar-ink"
      }`}
    >
      <aba.icon className="h-[22px] w-[22px]" aria-hidden="true" />
      {aba.nome}
    </NavLink>
  );
}

/** Barra inferior do celular (abaixo de 768 px): Hoje · Diário · [+] · Cardápio · Agente. */
export function BottomTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-3.5 bottom-[max(14px,env(safe-area-inset-bottom))] z-30 flex h-[68px] items-center justify-around rounded-[26px] bg-bar px-1.5 md:hidden"
    >
      {ESQUERDA.map((a) => (
        <Tab key={a.to} aba={a} pathname={location.pathname} />
      ))}
      <button
        type="button"
        aria-label="Registrar"
        onClick={() => openRegistrar(navigate, location)}
        className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-act text-on-act active:scale-[.97]"
      >
        <Plus className="h-6 w-6" strokeWidth={2.6} aria-hidden="true" />
      </button>
      {DIREITA.map((a) => (
        <Tab key={a.to} aba={a} pathname={location.pathname} />
      ))}
    </nav>
  );
}
