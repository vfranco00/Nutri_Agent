// Rótulos e cores compartilhados entre as páginas do painel admin.

export const PLAN_COLORS: Record<string, string> = {
  starter: "#71717a",
  plus: "#52cc02",
  pro: "#a855f7",
};

export const EVENT_LABELS: Record<string, string> = {
  chef_ai: "Chef IA",
  generate_plan_daily: "Cardápio diário",
  generate_plan_weekly: "Cardápio semanal",
  generate_plan_starter: "Cardápio (Starter)",
  meal_swap: "Troca de refeição",
};

export const PAYMENT_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  approved: { label: "Aprovado", className: "bg-green-500/10 text-green-400 border-green-500/20" },
  rejected: { label: "Rejeitado", className: "bg-red-500/10 text-red-400 border-red-500/20" },
  pending: { label: "Pendente", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
};

export const FEEDBACK_CATEGORY_LABELS: Record<string, string> = {
  duvida: "Dúvida",
  bug: "Bug",
  sugestao: "Sugestão",
  outro: "Outro",
};

export const GOAL_LABELS: Record<string, string> = {
  lose_weight: "Emagrecer",
  gain_muscle: "Ganhar massa",
  maintain: "Manter peso",
  maintain_weight: "Manter peso",
};

export const DIET_LABELS: Record<string, string> = {
  omnivore: "Onívoro",
  vegetarian: "Vegetariano",
  vegan: "Vegano",
  low_carb: "Low carb",
  keto: "Cetogênica",
};

export function labelFor(map: Record<string, string>, key: string): string {
  return map[key] || key;
}
