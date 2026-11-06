import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import { MEAL_SLOTS, type Recipe } from "../types";
import { BouncingDots } from "../components/BouncingDots";
import { ArrowLeft, BookOpen, Flame, Plus, Save, Search, Trash2, UserRound, Users } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Sheet } from "../components/ui/Sheet";
import { Skeleton } from "../components/ui/Skeleton";
import { ROUTES } from "../routes";

interface BuilderMeal {
  slot_name: string;
  recipe_id: number;
  recipe_title: string;
  recipe_calories?: number;
}

interface BuilderDay {
  day_label: string;
  meals: BuilderMeal[];
}

export function MealPlanBuilder() {
  const navigate = useNavigate();
  const { showAlert } = useAlert();

  const [title, setTitle] = useState("Meu Plano Alimentar");
  const [numDays, setNumDays] = useState(1);
  const [days, setDays] = useState<BuilderDay[]>([
    { day_label: "Dia 1", meals: [] },
  ]);
  const [saving, setSaving] = useState(false);

  // Picker de receita
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerDayIndex, setPickerDayIndex] = useState<number | null>(null);
  const [pickerSlot, setPickerSlot] = useState(MEAL_SLOTS[0]);
  const [pickerTab, setPickerTab] = useState<"mine" | "community">("mine");
  const [pickerRecipes, setPickerRecipes] = useState<Recipe[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  function updateNumDays(n: number) {
    setNumDays(n);
    setDays((prev) => {
      const next = [...prev];
      while (next.length < n) {
        next.push({ day_label: `Dia ${next.length + 1}`, meals: [] });
      }
      return next.slice(0, n);
    });
  }

  function openPicker(dayIndex: number) {
    setPickerDayIndex(dayIndex);
    setPickerSlot(MEAL_SLOTS[0]);
    setPickerSearch("");
    setPickerOpen(true);
  }

  useEffect(() => {
    if (!pickerOpen) return;
    async function loadPickerRecipes() {
      setPickerLoading(true);
      try {
        const endpoint = pickerTab === "mine" ? "/recipes/" : "/recipes/public";
        const res = await api.get(endpoint);
        setPickerRecipes(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error(error);
        setPickerRecipes([]);
      } finally {
        setPickerLoading(false);
      }
    }
    loadPickerRecipes();
  }, [pickerOpen, pickerTab]);

  function handlePickRecipe(recipe: Recipe) {
    if (pickerDayIndex === null) return;
    setDays((prev) => {
      const next = [...prev];
      next[pickerDayIndex] = {
        ...next[pickerDayIndex],
        meals: [
          ...next[pickerDayIndex].meals,
          {
            slot_name: pickerSlot,
            recipe_id: recipe.id,
            recipe_title: recipe.title,
            recipe_calories: recipe.calories,
          },
        ],
      };
      return next;
    });
    setPickerOpen(false);
  }

  function removeMeal(dayIndex: number, mealIndex: number) {
    setDays((prev) => {
      const next = [...prev];
      next[dayIndex] = {
        ...next[dayIndex],
        meals: next[dayIndex].meals.filter((_, i) => i !== mealIndex),
      };
      return next;
    });
  }

  async function handleSave() {
    if (days.every((d) => d.meals.length === 0)) {
      showAlert("Adicione pelo menos uma refeição ao plano.", "warning");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title,
        source: "manual",
        days: days.map((d, i) => ({
          day_label: d.day_label,
          day_index: i,
          meals: d.meals.map((m) => ({
            slot_name: m.slot_name,
            recipe_id: m.recipe_id,
          })),
        })),
      };
      const res = await api.post("/meal-plans/", payload);
      showAlert("Plano alimentar salvo!", "success");
      navigate(ROUTES.cardapio(res.data.id));
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: { code?: string; message?: string } } } }).response
        ?.data?.detail;
      if (detail?.code === "PLAN_LIMIT_REACHED") {
        showAlert(detail.message ?? "Limite de planos atingido.", "warning");
      } else {
        showAlert("Erro ao salvar o plano.", "error");
      }
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  const filteredPickerRecipes = pickerRecipes.filter((r) =>
    r.title.toLowerCase().includes(pickerSearch.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-1 pb-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(ROUTES.cardapios)}
          aria-label="Voltar"
          className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-card active:scale-[.97]"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="text-[26px] font-black leading-[1.05] tracking-[-0.025em]">
          Criar <span className="text-act-text">plano manual</span>
        </h1>
      </div>

      <div className="mt-3 space-y-4 rounded-3xl bg-card p-4">
        <div>
          <label htmlFor="plano-nome" className="mb-1.5 block text-xs font-bold text-mut">
            Nome do plano
          </label>
          <Input id="plano-nome" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-bold text-mut">Quantos dias?</span>
          <div className="grid grid-cols-7 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={numDays === n}
                onClick={() => updateNumDays(n)}
                className={`rounded-xl py-2 text-sm font-extrabold ${numDays === n ? "bg-act text-on-act" : "bg-soft text-ink"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-3">
        {days.map((day, dayIndex) => {
          const dayTotal = day.meals.reduce((sum, m) => sum + (m.recipe_calories || 0), 0);
          return (
            <section key={dayIndex} aria-label={day.day_label} className="overflow-hidden rounded-3xl bg-card">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="text-[15px] font-extrabold">{day.day_label}</h2>
                {dayTotal > 0 && (
                  <span className="flex items-center gap-1 text-xs font-bold text-mut">
                    <Flame className="h-3.5 w-3.5 text-act-text" aria-hidden="true" /> {dayTotal} kcal
                  </span>
                )}
              </div>

              <ul>
                {day.meals.map((meal, mealIndex) => (
                  <li key={mealIndex} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                    <div className="min-w-0">
                      <span className="block text-xs font-bold uppercase tracking-wide text-act-text">
                        {meal.slot_name}
                      </span>
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        <BookOpen className="h-3.5 w-3.5 flex-none" aria-hidden="true" /> {meal.recipe_title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {meal.recipe_calories && <span className="text-xs text-mut">{meal.recipe_calories} kcal</span>}
                      <button
                        type="button"
                        onClick={() => removeMeal(dayIndex, mealIndex)}
                        aria-label={`Remover ${meal.recipe_title}`}
                        className="text-mut"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => openPicker(dayIndex)}
                className="flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-extrabold text-act-text"
              >
                <Plus className="h-4 w-4" aria-hidden="true" /> Adicionar refeição
              </button>
            </section>
          );
        })}
      </div>

      <div className="pt-4">
        <Button onClick={handleSave} disabled={saving} className="w-full py-3.5">
          {saving ? <BouncingDots /> : (
            <>
              <Save className="h-5 w-5" aria-hidden="true" /> Salvar plano
            </>
          )}
        </Button>
      </div>

      {/* ESCOLHA DE RECEITA */}
      <Sheet open={pickerOpen} onOpenChange={setPickerOpen} title="Escolher receita">
        <div className="space-y-3">
          <div>
            <label htmlFor="picker-slot" className="mb-1 block text-xs font-bold text-mut">
              Refeição
            </label>
            <select
              id="picker-slot"
              value={pickerSlot}
              onChange={(e) => setPickerSlot(e.target.value)}
              className="w-full rounded-2xl border border-line bg-card px-3 py-2.5 text-sm text-ink"
            >
              {MEAL_SLOTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-1.5">
            {(
              [
                ["mine", "Minhas receitas", UserRound],
                ["community", "Comunidade", Users],
              ] as const
            ).map(([k, nome, Icone]) => (
              <button
                key={k}
                type="button"
                aria-pressed={pickerTab === k}
                onClick={() => setPickerTab(k)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold ${
                  pickerTab === k ? "bg-ink text-bg" : "bg-soft text-ink"
                }`}
              >
                <Icone className="h-3.5 w-3.5" aria-hidden="true" /> {nome}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mut" aria-hidden="true" />
            <Input
              type="text"
              aria-label="Buscar receita"
              placeholder="Buscar receita..."
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="space-y-2 pt-1">
            {pickerLoading ? (
              <div aria-hidden="true" className="space-y-2">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : filteredPickerRecipes.length === 0 ? (
              <p className="py-8 text-center text-sm text-mut">Nenhuma receita encontrada.</p>
            ) : (
              filteredPickerRecipes.map((recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => handlePickRecipe(recipe)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl bg-bg p-3 text-left active:bg-soft"
                >
                  <span className="text-sm font-bold">{recipe.title}</span>
                  {recipe.calories && <span className="shrink-0 text-xs text-mut">{recipe.calories} kcal</span>}
                </button>
              ))
            )}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
