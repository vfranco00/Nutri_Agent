import {
  Home,
  User as UserIcon,
  Book,
  ChefHat,
  ShoppingCart,
  CalendarRange,
  Crown,
  Shield,
  MessageCircleHeart,
  NotebookPen,
  LineChart,
  Sparkles,
  Apple,
  Users,
  Bell,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ROUTES } from "../routes";

export interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
  color: string; // classe de cor do ícone
  keywords?: string; // termos extras pra busca do ⌘K
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

const COR = "text-act-text";

// Fonte única de navegação: menu lateral, busca rápida (⌘K) e título do topo.
// Grupos da spec §6; o Agente abre o grupo Acompanhar.
const GROUPS: NavGroup[] = [
  {
    title: "Acompanhar",
    items: [
      { name: "Agente", path: ROUTES.agente, icon: MessageCircleHeart, color: COR, keywords: "agente chat registrar texto foto" },
      { name: "Hoje", path: ROUTES.hoje, icon: Home, color: COR, keywords: "inicio home dashboard resumo dia" },
      { name: "Diário", path: ROUTES.diario, icon: NotebookPen, color: COR, keywords: "diario alimentar refeicao comida calorias almoco jantar" },
      { name: "Progresso", path: ROUTES.progresso, icon: LineChart, color: COR, keywords: "peso evolucao grafico" },
    ],
  },
  {
    title: "Planejar",
    items: [
      { name: "Cardápios", path: ROUTES.cardapios, icon: CalendarRange, color: COR, keywords: "cardapio planos alimentares salvos" },
      { name: "Gerar cardápio", path: ROUTES.cardapioGerar, icon: Sparkles, color: COR, keywords: "cardapio ia plano dieta gerar" },
      { name: "Lista de compras", path: ROUTES.compras, icon: ShoppingCart, color: COR, keywords: "compras mercado itens" },
    ],
  },
  {
    title: "Cozinhar",
    items: [
      { name: "Minhas receitas", path: ROUTES.receitas, icon: Book, color: COR, keywords: "receitas pratos" },
      { name: "Meus alimentos", path: ROUTES.alimentos, icon: Apple, color: COR, keywords: "alimentos pessoais codigo de barras" },
      { name: "Chef", path: ROUTES.chef, icon: ChefHat, color: COR, keywords: "chef ia receita ingredientes" },
      { name: "Comunidade", path: ROUTES.comunidade, icon: Users, color: COR, keywords: "comunidade receitas publicas" },
    ],
  },
  {
    title: "Conta",
    items: [
      { name: "Perfil e metas", path: ROUTES.perfil, icon: UserIcon, color: COR, keywords: "perfil metas peso dados" },
      { name: "Lembretes", path: ROUTES.lembretes, icon: Bell, color: COR, keywords: "lembretes notificacoes push agua" },
      { name: "Assinatura", path: ROUTES.assinatura, icon: Crown, color: COR, keywords: "planos assinatura upgrade preco" },
    ],
  },
];

const ADMIN_ITEM: NavItem = {
  name: "Admin",
  path: "/admin",
  icon: Shield,
  color: "text-red-500",
  keywords: "admin painel gestao",
};

/** Grupos do menu lateral; o Admin entra no fim de Conta só para superusuário. */
export function getNavGroups(isSuperuser: boolean): NavGroup[] {
  if (!isSuperuser) return GROUPS;
  return GROUPS.map((g) => (g.title === "Conta" ? { ...g, items: [...g.items, ADMIN_ITEM] } : g));
}

export function getNavItems(isSuperuser: boolean): NavItem[] {
  return getNavGroups(isSuperuser).flatMap((g) => g.items);
}

// Título da seção pro topo. Casa a rota atual com o item mais específico
// (maior prefixo), cobrindo subrotas tipo /receitas/nova e /admin/users.
export function sectionTitleForPath(pathname: string): string {
  if (pathname.startsWith("/admin")) return "Painel Admin";
  const match = getNavItems(true)
    .filter((i) => pathname === i.path || pathname.startsWith(i.path + "/"))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match?.name ?? "Nuvi";
}
