import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import { useSubscription } from "../lib/SubscriptionContext";
import { LoadingOverlay } from "../components/LoadingOverlay";
import {
  ArrowLeft,
  Check,
  Loader2,
  Crown,
  Sparkles,
} from "lucide-react";

const PLANS = [
  {
    id: "starter" as const,
    name: "Starter",
    price: "Grátis",
    color: "zinc",
    features: [
      "2 cardápios (semanal ou diário) por mês",
      "Chef IA — 5 receitas por semana",
      "Até 10 receitas próprias salvas",
      "Até 5 planos alimentares salvos",
      "Lista de compras não incluída",
    ],
  },
  {
    id: "plus" as const,
    name: "Plus",
    price: "R$ 29,90/mês",
    color: "green",
    highlight: true,
    features: [
      "1 cardápio semanal + cardápio diário todo dia",
      "Chef IA — 30 receitas por mês",
      "Até 50 receitas próprias salvas",
      "Até 30 planos alimentares salvos",
      "Lista de compras liberada",
    ],
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "R$ 59,90/mês",
    color: "purple",
    features: [
      "Cardápios ilimitados (semanal e diário)",
      "Chef IA ilimitado",
      "Planos alimentares ilimitados",
      "Lista de compras liberada",
      "Receitas próprias ilimitadas",
    ],
  },
];

export function Plans() {
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  const { subscription, refreshSubscription } = useSubscription();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  async function handleSubscribe(planId: "plus" | "pro") {
    setLoadingPlan(planId);
    try {
      const res = await api.post("/subscriptions/checkout", { plan: planId });
      window.location.href = res.data.checkout_url;
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      if (detail?.code === "CHECKOUT_UNAVAILABLE") {
        showAlert(detail.message || "Assinatura online ainda não está disponível.", "info");
      } else {
        showAlert("Erro ao iniciar a assinatura. Tente novamente.", "error");
      }
    } finally {
      setLoadingPlan(null);
      refreshSubscription();
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      {loadingPlan && <LoadingOverlay text="Preparando seu checkout..." />}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate("/dashboard")}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-6 w-6 text-zinc-500 dark:text-zinc-400" />
        </button>
        <h1 className="text-2xl font-bold text-amber-500 flex items-center gap-2">
          <Crown className="h-7 w-7" /> Planos
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isCurrent = subscription?.plan === plan.id;
          return (
            <div
              key={plan.id}
              className={`rounded-2xl border p-6 flex flex-col ${
                plan.highlight
                  ? "border-green-500 bg-green-50/50 dark:bg-green-500/5 shadow-lg"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
              }`}
            >
              {plan.highlight && (
                <span className="self-start mb-3 text-[10px] font-bold uppercase tracking-wide bg-green-600 text-white px-2 py-1 rounded-full">
                  Mais popular
                </span>
              )}
              <h2 className="text-lg font-bold dark:text-white mb-1">{plan.name}</h2>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">{plan.price}</p>
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <span className="text-center text-sm font-bold text-zinc-500 dark:text-zinc-400 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  Seu plano atual
                </span>
              ) : plan.id === "starter" ? (
                <span className="text-center text-sm text-zinc-400 py-2.5">Plano gratuito</span>
              ) : (
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loadingPlan === plan.id}
                  className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loadingPlan === plan.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Assinar
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
