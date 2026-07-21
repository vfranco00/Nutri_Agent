import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import { MEAL_SLOTS, type Recipe } from "../types";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Save,
  Flame,
  X,
  BookOpen,
  Users,
  UserRound,
  Search,
} from "lucide-react";

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
      navigate(`/meal-plans/${res.data.id}`);
    } catch (error) {
      showAlert("Erro ao salvar o plano.", "error");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  const filteredPickerRecipes = pickerRecipes.filter((r) =>
    r.title.toLowerCase().includes(pickerSearch.toLowerCase()),
  );

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate("/meal-plans")}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
        >
          <ArrowLeft className="h-6 w-6 text-zinc-500 dark:text-zinc-400" />
        </button>
        <h1 className="text-2xl font-bold text-teal-600 dark:text-teal-500">
          Criar Plano Manual
        </h1>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm mb-6 space-y-4">
        <div>
          <label className="text-sm text-zinc-500 dark:text-zinc-400 mb-2 block">
            Nome do Plano
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
          />
        </div>
        <div>
          <label className="text-sm text-zinc-500 dark:text-zinc-400 mb-2 block">
            Quantos dias?
          </label>
          <div className="grid grid-cols-7 gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button
                key={n}
                onClick={() => updateNumDays(n)}
                className={`py-2 rounded-lg text-sm font-medium transition-all ${
                  numDays === n
                    ? "bg-teal-600 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {days.map((day, dayIndex) => {
          const dayTotal = day.meals.reduce(
            (sum, m) => sum + (m.recipe_calories || 0),
            0,
          );
          return (
            <div
              key={dayIndex}
              className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm"
            >
              <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/30 flex items-center justify-between">
                <h3 className="font-semibold text-zinc-700 dark:text-zinc-200">
                  {day.day_label}
                </h3>
                {dayTotal > 0 && (
                  <span className="text-xs flex items-center gap-1 text-zinc-500">
                    <Flame className="h-3.5 w-3.5 text-red-500" /> {dayTotal} kcal
                  </span>
                )}
              </div>

              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {day.meals.map((meal, mealIndex) => (
                  <div
                    key={mealIndex}
                    className="p-4 flex items-center justify-between gap-3"
                  >
                    <div>
                      <span className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wide block">
                        {meal.slot_name}
                      </span>
                      <span className="text-sm text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5" /> {meal.recipe_title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {meal.recipe_calories && (
                        <span className="text-xs text-zinc-400">
                          {meal.recipe_calories} kcal
                        </span>
                      )}
                      <button
                        onClick={() => removeMeal(dayIndex, mealIndex)}
                        className="text-zinc-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => openPicker(dayIndex)}
                className="w-full p-3 text-sm text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 flex items-center justify-center gap-2 font-medium transition-colors"
              >
                <Plus className="h-4 w-4" /> Adicionar Refeição
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full mt-6 bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-lg flex justify-center gap-2 shadow-sm disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="animate-spin h-5 w-5" />
        ) : (
          <Save className="h-5 w-5" />
        )}
        Salvar Plano
      </button>

      {/* MODAL DE ESCOLHA DE RECEITA */}
      {pickerOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 rounded-t-2xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold dark:text-white">
                  Escolher Receita
                </h3>
                <button
                  onClick={() => setPickerOpen(false)}
                  className="text-zinc-500 hover:text-zinc-800 dark:hover:text-white"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div>
                <label className="text-xs text-zinc-500 mb-1 block">
                  Refeição
                </label>
                <select
                  value={pickerSlot}
                  onChange={(e) => setPickerSlot(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-sm dark:text-white outline-none"
                >
                  {MEAL_SLOTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                <button
                  onClick={() => setPickerTab("mine")}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${pickerTab === "mine" ? "bg-white dark:bg-zinc-700 shadow text-teal-600 dark:text-white" : "text-zinc-500"}`}
                >
                  <UserRound className="h-3.5 w-3.5" /> Minhas Receitas
                </button>
                <button
                  onClick={() => setPickerTab("community")}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${pickerTab === "community" ? "bg-white dark:bg-zinc-700 shadow text-teal-600 dark:text-white" : "text-zinc-500"}`}
                >
                  <Users className="h-3.5 w-3.5" /> Comunidade
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Buscar receita..."
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg py-2 pl-9 pr-4 text-sm dark:text-white outline-none"
                />
              </div>
            </div>

            <div className="p-4 overflow-y-auto space-y-2">
              {pickerLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin h-6 w-6 text-teal-500" />
                </div>
              ) : filteredPickerRecipes.length === 0 ? (
                <p className="text-center text-sm text-zinc-400 py-8">
                  Nenhuma receita encontrada.
                </p>
              ) : (
                filteredPickerRecipes.map((recipe) => (
                  <button
                    key={recipe.id}
                    onClick={() => handlePickRecipe(recipe)}
                    className="w-full text-left p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-teal-300 dark:hover:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-500/5 transition-colors flex items-center justify-between gap-3"
                  >
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                      {recipe.title}
                    </span>
                    {recipe.calories && (
                      <span className="text-xs text-zinc-400 shrink-0">
                        {recipe.calories} kcal
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
