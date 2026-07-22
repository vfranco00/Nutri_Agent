import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, X } from "lucide-react";
import { useSubscription } from "../lib/SubscriptionContext";

const WARNING_WINDOW_DAYS = 7;
const DISMISS_KEY = "nutri_expiry_banner_dismissed";

const PLAN_LABELS: Record<string, string> = { starter: "Starter", plus: "Plus", pro: "Pro" };

export function SubscriptionExpiryBanner() {
  const navigate = useNavigate();
  const { subscription } = useSubscription();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === subscription?.current_period_end,
  );

  if (
    !subscription ||
    subscription.plan === "starter" ||
    subscription.status !== "active" ||
    !subscription.current_period_end
  ) {
    return null;
  }

  const expiresAt = new Date(subscription.current_period_end);
  const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0 || daysLeft > WARNING_WINDOW_DAYS || dismissed) {
    return null;
  }

  function handleDismiss() {
    if (subscription?.current_period_end) {
      sessionStorage.setItem(DISMISS_KEY, subscription.current_period_end);
    }
    setDismissed(true);
  }

  return (
    <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 px-4 py-3">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0" />
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Sua assinatura <strong>{PLAN_LABELS[subscription.plan]}</strong> vence em{" "}
          <strong>{daysLeft <= 0 ? "hoje" : `${daysLeft} dia${daysLeft > 1 ? "s" : ""}`}</strong> (
          {expiresAt.toLocaleDateString("pt-BR")}). Renove pra manter o acesso.
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate("/planos")}
          className="text-sm font-medium text-amber-700 dark:text-amber-400 hover:underline"
        >
          Renovar
        </button>
        <button
          onClick={handleDismiss}
          className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
