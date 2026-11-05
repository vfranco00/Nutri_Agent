import type { Location, NavigateFunction } from "react-router-dom";

/** Rotas do app (em português). Rotas antigas redirecionam via LEGACY_REDIRECTS. */
export const ROUTES = {
  hoje: "/hoje",
  diario: "/diario",
  registrar: "/registrar",
  codigoDeBarras: "/registrar/codigo-de-barras",
  alimento: (ref: string) => `/registrar/alimento/${encodeURIComponent(ref)}`,
  alimentos: "/alimentos",
  alimentoNovo: "/alimentos/novo",
  agente: "/agente",
  progresso: "/progresso",
  cardapios: "/cardapios",
  cardapioNovo: "/cardapios/novo",
  cardapioGerar: "/cardapios/gerar",
  cardapio: (id: string | number) => `/cardapios/${id}`,
  compras: "/compras",
  receitas: "/receitas",
  receitaNova: "/receitas/nova",
  receita: (id: string | number) => `/receitas/${id}`,
  chef: "/chef",
  comunidade: "/comunidade",
  perfil: "/perfil",
  lembretes: "/perfil/lembretes",
  privacidadePerfil: "/perfil/privacidade",
  politica: "/privacidade",
  termos: "/termos",
  assinatura: "/assinatura",
} as const;

/** [de, para]. `:id` do destino é preenchido com o `:id` da origem; a query e o hash seguem junto. */
export const LEGACY_REDIRECTS: Array<[from: string, to: string]> = [
  ["/dashboard", "/hoje"],
  ["/profile", "/perfil"],
  ["/recipes", "/receitas"],
  ["/recipes/new", "/receitas/nova"],
  ["/ai-plan", "/cardapios/gerar"],
  ["/ai-chef", "/chef"],
  ["/shopping", "/compras"],
  ["/meal-plans", "/cardapios"],
  ["/meal-plans/new", "/cardapios/novo"],
  ["/meal-plans/:id", "/cardapios/:id"],
  ["/planos", "/assinatura"],
];

export type Refeicao = "cafe" | "almoco" | "lanche" | "jantar";

/** Antes das 10h café, até as 15h almoço, até as 18h lanche, depois jantar. */
export function refeicaoPorHorario(now: Date = new Date()): Refeicao {
  const h = now.getHours();
  if (h < 10) return "cafe";
  if (h < 15) return "almoco";
  if (h < 18) return "lanche";
  return "jantar";
}

/**
 * Abre `/registrar` como folha por cima da tela atual (`state.background`).
 * Sem refeição informada, ela é escolhida pelo horário.
 */
export function openRegistrar(
  navigate: NavigateFunction | ((to: string, opts?: { state?: unknown }) => void),
  location: Location,
  opts: { refeicao?: Refeicao; data?: string; now?: Date } = {},
): void {
  const params = new URLSearchParams();
  params.set("refeicao", opts.refeicao ?? refeicaoPorHorario(opts.now));
  if (opts.data) params.set("data", opts.data);
  navigate(`${ROUTES.registrar}?${params.toString()}`, { state: { background: location } });
}
