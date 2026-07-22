import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import { useSubscription } from "../lib/SubscriptionContext";
import type { MealPlan } from "../types";
import {
  CalendarRange,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
  UserRound,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";

export function MealPlans() {
  const navigate = useNavigate();
  const { showAlert, confirmDialog } = useAlert();
  const { subscription } = useSubscription();
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const atMealPlanLimit =
    subscription?.max_saved_meal_plans !== null &&
    subscription?.max_saved_meal_plans !== undefined &&
    plans.length >= subscription.max_saved_meal_plans;
  const [loading, setLoading] = useState(true);

  async function loadPlans() {
    setLoading(true);
    try {
      const res = await api.get("/meal-plans/");
      setPlans(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error(error);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlans();
  }, []);

  async function handleDelete(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!(await confirmDialog("Excluir este plano alimentar?", { danger: true }))) return;
    try {
      await api.delete(`/meal-plans/${id}`);
      setPlans((prev) => prev.filter((p) => p.id !== id));
      showAlert("Plano excluído.", "success");
    } catch (error) {
      showAlert("Erro ao excluir plano.", "error");
      console.error(error);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center mt-20">
        <Loader2 className="animate-spin h-8 w-8 text-teal-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-teal-600 dark:text-teal-500 flex items-center gap-2">
          <CalendarRange className="h-7 w-7" /> Planos Alimentares
        </h1>
        <button
          onClick={() =>
            atMealPlanLimit
              ? showAlert(
                  `Seu plano permite no máximo ${subscription?.max_saved_meal_plans} planos alimentares salvos. Faça upgrade pra criar mais.`,
                  "warning",
                )
              : navigate("/meal-plans/new")
          }
          className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
        >
          <Plus className="h-5 w-5" /> Criar Plano Manual
        </button>
      </div>

      {subscription?.max_saved_meal_plans !== null && subscription?.max_saved_meal_plans !== undefined && (
        <p className="text-xs text-zinc-400 -mt-4 mb-6">
          {plans.length}/{subscription.max_saved_meal_plans} planos salvos
          {atMealPlanLimit && (
            <>
              {" "}—{" "}
              <button onClick={() => navigate("/planos")} className="text-teal-500 hover:underline font-medium">
                fazer upgrade
              </button>
            </>
          )}
        </p>
      )}

      {plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 border-dashed text-center px-4">
          <CalendarRange className="h-10 w-10 text-zinc-300 dark:text-zinc-700 mb-3" />
          <p className="text-zinc-500 dark:text-zinc-400 mb-1">
            Você ainda não tem planos alimentares salvos.
          </p>
          <p className="text-zinc-400 dark:text-zinc-500 text-sm">
            Gere um cardápio com a IA e salve, ou monte um manualmente com suas receitas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              onClick={() => navigate(`/meal-plans/${plan.id}`)}
              className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:border-teal-300 dark:hover:border-teal-700 cursor-pointer transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {plan.source === "ai" ? (
                    <span className="p-2 rounded-full bg-purple-100 dark:bg-purple-500/10">
                      <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </span>
                  ) : (
                    <span className="p-2 rounded-full bg-teal-100 dark:bg-teal-500/10">
                      <UserRound className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    </span>
                  )}
                  <div>
                    <h3 className="font-bold text-zinc-800 dark:text-zinc-100">
                      {plan.title}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      {plan.days.length} dia(s) ·{" "}
                      {format(new Date(plan.created_at), "dd/MM/yyyy")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(plan.id, e)}
                  className="text-zinc-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
                <span>
                  {plan.days.reduce((sum, d) => sum + d.meals.length, 0)} refeições
                </span>
                <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-teal-500 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
