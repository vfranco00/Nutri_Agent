import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import type { MealPlan } from "../types";
import { ArrowLeft, BookOpen, Check, Loader2, Pencil, Sparkles, UserRound, X } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Skeleton } from "../components/ui/Skeleton";
import { fotoPorRotulo } from "../lib/refeicaoFoto";
import { ROUTES } from "../routes";

export function MealPlanDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(0);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);

  useEffect(() => {
    async function loadPlan() {
      setLoading(true);
      try {
        const res = await api.get(`/meal-plans/${id}`);
        setPlan(res.data);
      } catch (error) {
        showAlert("Não foi possível carregar este plano.", "error");
        console.error(error);
        navigate(ROUTES.cardapios);
      } finally {
        setLoading(false);
      }
    }
    loadPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function startEditingTitle() {
    if (!plan) return;
    setTitleInput(plan.title);
    setEditingTitle(true);
  }

  async function handleRenamePlan() {
    if (!plan) return;
    const title = titleInput.trim();
    if (!title) return;
    setSavingTitle(true);
    try {
      const res = await api.patch(`/meal-plans/${plan.id}`, { title });
      setPlan(res.data);
      setEditingTitle(false);
      showAlert("Nome do plano atualizado!", "success");
    } catch (error) {
      showAlert("Erro ao renomear o plano.", "error");
      console.error(error);
    } finally {
      setSavingTitle(false);
    }
  }

  if (loading || !plan) {
    return (
      <div aria-hidden="true" className="space-y-2">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-24 rounded-3xl" />
        <Skeleton className="h-40 rounded-3xl" />
      </div>
    );
  }

  const day = plan.days[selectedDay];
  const macros: Array<[string | null | undefined, string]> = [
    [day?.macros_protein, "Proteína"],
    [day?.macros_carbs, "Carbo"],
    [day?.macros_fats, "Gordura"],
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-1">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(ROUTES.cardapios)}
          aria-label="Voltar"
          className="flex h-10 w-10 flex-none items-center justify-center rounded-[14px] bg-card active:scale-[.97]"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <Input
                type="text"
                autoFocus
                aria-label="Nome do plano"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenamePlan();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                className="py-2 text-base font-extrabold"
              />
              <button
                type="button"
                onClick={handleRenamePlan}
                disabled={savingTitle}
                aria-label="Salvar nome"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-act text-on-act disabled:opacity-50"
              >
                {savingTitle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setEditingTitle(false)}
                aria-label="Cancelar"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-soft"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <h1 className="flex items-center gap-2 text-[22px] font-black leading-tight tracking-[-0.02em]">
              {plan.source === "ai" ? (
                <Sparkles className="h-5 w-5 flex-none text-act-text" aria-hidden="true" />
              ) : (
                <UserRound className="h-5 w-5 flex-none text-act-text" aria-hidden="true" />
              )}
              <span className="truncate">{plan.title}</span>
              <button
                type="button"
                onClick={startEditingTitle}
                aria-label="Renomear plano"
                className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-mut"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </button>
            </h1>
          )}
          <p className="text-xs font-semibold text-mut">
            {plan.source === "ai" ? "Gerado por IA" : "Montado manualmente"}
          </p>
        </div>
      </div>

      {plan.days.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto py-3">
          {plan.days.map((d, i) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={selectedDay === i}
              onClick={() => setSelectedDay(i)}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[12.5px] font-bold ${
                selectedDay === i ? "bg-ink text-bg" : "bg-card text-ink"
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
            <div className="mt-2 rounded-3xl bg-card px-4 py-3.5">
              {day.calories_target && (
                <div className="flex items-baseline justify-between">
                  <b className="text-[13px]">Meta do dia</b>
                  <span className="text-[26px] font-black tabular-nums">
                    {day.calories_target} <span className="text-xs font-bold text-mut">kcal</span>
                  </span>
                </div>
              )}
              <div className="mt-2 flex gap-2">
                {macros
                  .filter(([v]) => v)
                  .map(([v, nome]) => (
                    <div key={nome} className="flex-1 rounded-2xl bg-soft px-2 py-2.5 text-center text-[11.5px] text-mut">
                      <b className="block text-[14.5px] text-ink">{v}</b>
                      {nome}
                    </div>
                  ))}
              </div>
            </div>
          )}

          <h2 className="px-1 pb-1 pt-4 text-base font-extrabold">Refeições</h2>
          <ul className="space-y-2">
            {day.meals.map((meal) => {
              const kcal = meal.calories || meal.recipe?.calories;
              return (
                <li key={meal.id} className="flex items-center gap-3 rounded-[22px] bg-card px-3.5 py-3">
                  <div
                    role="img"
                    aria-label={meal.slot_name}
                    className="h-14 w-14 flex-none rounded-2xl bg-cover bg-center"
                    style={{ backgroundImage: `url(${fotoPorRotulo(meal.slot_name)})` }}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-bold uppercase tracking-wide text-act-text">
                      {meal.slot_name}
                    </span>
                    {meal.recipe ? (
                      <button
                        type="button"
                        onClick={() => navigate(ROUTES.receita(meal.recipe!.id))}
                        className="flex items-center gap-1.5 text-left text-[15px] font-extrabold"
                      >
                        <BookOpen className="h-4 w-4 flex-none" aria-hidden="true" /> {meal.recipe.title}
                      </button>
                    ) : (
                      <>
                        {meal.custom_title && <b className="block text-[15px]">{meal.custom_title}</b>}
                        {meal.custom_description && (
                          <p className="mt-0.5 text-[13px] text-mut">{meal.custom_description}</p>
                        )}
                      </>
                    )}
                  </div>
                  {kcal ? (
                    <span className="shrink-0 rounded-full bg-soft px-2.5 py-1 text-xs font-bold tabular-nums text-mut">
                      ~{kcal} kcal
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="pt-4">
            <Button variant="outline" onClick={() => navigate(ROUTES.compras)} className="w-full">
              Ver lista de compras
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
