import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import { useSubscription } from "../lib/SubscriptionContext";
import { BouncingDots } from "../components/BouncingDots";
import { PageTitle } from "../components/PageTitle";
import { Button } from "../components/ui/Button";
import { ROUTES } from "../routes";
import { ArrowLeft, Check, Sparkles } from "lucide-react";

const PLANS = [
  {
    id: "starter" as const,
    name: "Starter",
    price: "Grátis",
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
    <div className="mx-auto max-w-5xl">
      <button
        onClick={() => navigate(ROUTES.hoje)}
        aria-label="Voltar"
        className="-ml-2 mb-2 flex h-10 w-10 items-center justify-center rounded-2xl text-ink hover:bg-soft"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <PageTitle a="Escolha" b="seu plano" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = subscription?.plan === plan.id;
          return (
            <div
              key={plan.id}
              className={`flex flex-col rounded-3xl bg-card p-5 ${plan.highlight ? "border-2 border-act" : "border border-line"}`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <h2 className="text-[17px] font-extrabold text-ink">{plan.name}</h2>
                {isCurrent ? (
                  <span className="rounded-md bg-act-soft px-1.5 py-0.5 text-[9.5px] font-black tracking-wide text-act-text">
                    SEU PLANO
                  </span>
                ) : plan.highlight ? (
                  <span className="rounded-md bg-act-soft px-1.5 py-0.5 text-[9.5px] font-black tracking-wide text-act-text">
                    MAIS POPULAR
                  </span>
                ) : null}
              </div>
              <p className="mb-4 text-[22px] font-black tracking-tight text-ink">{plan.price}</p>
              <ul className="mb-6 flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] leading-snug text-ink">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-pos-text" /> {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <span className="rounded-2xl border border-line py-3 text-center text-sm font-bold text-mut">
                  Seu plano atual
                </span>
              ) : plan.id === "starter" ? (
                <span className="py-3 text-center text-sm font-semibold text-mut">Plano gratuito</span>
              ) : (
                <Button onClick={() => handleSubscribe(plan.id)} disabled={loadingPlan === plan.id}>
                  {loadingPlan === plan.id ? <BouncingDots /> : <><Sparkles className="h-4 w-4" /> Assinar</>}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
