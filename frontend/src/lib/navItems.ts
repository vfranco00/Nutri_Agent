import {
  Home,
  User as UserIcon,
  Book,
  CheckCheck,
  ChefHat,
  ShoppingCart,
  CalendarRange,
  Crown,
  Shield,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
  color: string; // classe de cor do ícone quando ativo
  keywords?: string; // termos extras pra busca do ⌘K
}

// Fonte única de navegação — usada pela Sidebar, pela busca rápida (⌘K) e pelo
// título/breadcrumb do topo, pra não desincronizar.
const BASE_ITEMS: NavItem[] = [
  { name: "Início", path: "/dashboard", icon: Home, color: "text-zinc-500 dark:text-zinc-400", keywords: "home dashboard" },
  { name: "Meu Perfil", path: "/profile", icon: UserIcon, color: "text-green-500", keywords: "perfil metas peso dados" },
  { name: "Minhas Receitas", path: "/recipes", icon: Book, color: "text-orange-500", keywords: "receitas pratos comunidade" },
  { name: "Gerar Cardápio", path: "/ai-plan", icon: CheckCheck, color: "text-purple-500", keywords: "cardapio ia plano dieta" },
  { name: "Chef IA", path: "/ai-chef", icon: ChefHat, color: "text-blue-500", keywords: "chef ia receita ingredientes" },
  { name: "Lista de Compras", path: "/shopping", icon: ShoppingCart, color: "text-pink-500", keywords: "compras mercado itens" },
  { name: "Planos Alimentares", path: "/meal-plans", icon: CalendarRange, color: "text-teal-500", keywords: "planos alimentares cardapios salvos" },
  { name: "Assinatura", path: "/planos", icon: Crown, color: "text-amber-500", keywords: "planos assinatura upgrade preco" },
];

const ADMIN_ITEM: NavItem = {
  name: "Admin",
  path: "/admin",
  icon: Shield,
  color: "text-red-500",
  keywords: "admin painel gestao",
};

export function getNavItems(isSuperuser: boolean): NavItem[] {
  return isSuperuser ? [...BASE_ITEMS, ADMIN_ITEM] : BASE_ITEMS;
}

// Título da seção pro breadcrumb do topo. Casa a rota atual com o item mais
// específico (maior prefixo), cobrindo subrotas tipo /recipes/new e /admin/users.
export function sectionTitleForPath(pathname: string): string {
  if (pathname.startsWith("/admin")) return "Painel Admin";
  const all = [...BASE_ITEMS, ADMIN_ITEM];
  const match = all
    .filter((i) => pathname === i.path || pathname.startsWith(i.path + "/"))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match?.name ?? "NutriAgent";
}
