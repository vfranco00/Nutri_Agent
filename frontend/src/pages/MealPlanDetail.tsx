import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import type { MealPlan } from "../types";
import {
  ArrowLeft,
  Loader2,
  Utensils,
  Flame,
  Sparkles,
  UserRound,
  BookOpen,
} from "lucide-react";

export function MealPlanDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(0);

  useEffect(() => {
    async function loadPlan() {
      setLoading(true);
      try {
        const res = await api.get(`/meal-plans/${id}`);
        setPlan(res.data);
      } catch (error) {
        showAlert("Não foi possível carregar este plano.", "error");
        console.error(error);
        navigate("/meal-plans");
      } finally {
        setLoading(false);
      }
    }
    loadPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading || !plan) {
    return (
      <div className="flex justify-center mt-20">
        <Loader2 className="animate-spin h-8 w-8 text-teal-500" />
      </div>
    );
  }

  const day = plan.days[selectedDay];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate("/meal-plans")}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
        >
          <ArrowLeft className="h-6 w-6 text-zinc-500 dark:text-zinc-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-teal-600 dark:text-teal-500 flex items-center gap-2">
            {plan.source === "ai" ? (
              <Sparkles className="h-6 w-6" />
            ) : (
              <UserRound className="h-6 w-6" />
            )}
            {plan.title}
          </h1>
          <p className="text-xs text-zinc-400">
            {plan.source === "ai" ? "Gerado por IA" : "Montado manualmente"}
          </p>
        </div>
      </div>

      {plan.days.length > 1 && (
        <div className="flex gap-2 overflow-x-auto mb-6 pb-1">
          {plan.days.map((d, i) => (
            <button
              key={d.id}
              onClick={() => setSelectedDay(i)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedDay === i
                  ? "bg-teal-600 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {d.day_label}
            </button>
          ))}
        </div>
      )}

      {day && (
        <>
          {(day.calories_target || day.macros_protein) && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {day.calories_target && (
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center text-center">
                  <Flame className="h-5 w-5 text-red-500 mb-1" />
                  <span className="text-xl font-bold dark:text-white">
                    {day.calories_target}
                  </span>
                  <span className="text-xs text-zinc-500 uppercase">Kcal</span>
                </div>
              )}
              {day.macros_protein && (
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center text-center">
                  <span className="text-lg font-bold text-blue-500">
                    {day.macros_protein}
                  </span>
                  <span className="text-xs text-zinc-500 uppercase">Proteína</span>
                </div>
              )}
              {day.macros_carbs && (
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center text-center">
                  <span className="text-lg font-bold text-yellow-500">
                    {day.macros_carbs}
                  </span>
                  <span className="text-xs text-zinc-500 uppercase">Carbo</span>
                </div>
              )}
              {day.macros_fats && (
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center text-center">
                  <span className="text-lg font-bold text-orange-500">
                    {day.macros_fats}
                  </span>
                  <span className="text-xs text-zinc-500 uppercase">Gordura</span>
                </div>
              )}
            </div>
          )}

          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/30">
              <h3 className="font-semibold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
                <Utensils className="h-5 w-5 text-teal-500" /> Refeições
              </h3>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {day.meals.map((meal) => (
                <div key={meal.id} className="p-5 flex justify-between items-start gap-4">
                  <div>
                    <h4 className="text-teal-600 dark:text-teal-400 font-bold mb-1 text-xs uppercase tracking-wide">
                      {meal.slot_name}
                    </h4>
                    {meal.recipe ? (
                      <button
                        onClick={() => navigate("/recipes")}
                        className="flex items-center gap-2 text-zinc-700 dark:text-zinc-200 font-medium hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                      >
                        <BookOpen className="h-4 w-4" /> {meal.recipe.title}
                      </button>
                    ) : (
                      <>
                        {meal.custom_title && (
                          <p className="text-zinc-800 dark:text-zinc-100 font-medium">
                            {meal.custom_title}
                          </p>
                        )}
                        {meal.custom_description && (
                          <p className="text-zinc-600 dark:text-zinc-300 text-sm mt-1">
                            {meal.custom_description}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  {(meal.calories || meal.recipe?.calories) && (
                    <span className="shrink-0 text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-full text-zinc-600 dark:text-zinc-400">
                      ~{meal.calories || meal.recipe?.calories} kcal
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
