import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import { useSubscription } from "../lib/SubscriptionContext";
import { LoadingOverlay } from "../components/LoadingOverlay";
import type { AiPlanResponse, DailyPlan } from "../types";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Target,
  Zap,
  Utensils,
  Lightbulb,
  Save,
  Calendar,
  Repeat,
  Shuffle,
  ShoppingCart,
  X,
  CheckSquare,
  Square,
  Edit3,
} from "lucide-react";

export function AiPlan() {
  const navigate = useNavigate();
  const { showAlert, confirmDialog } = useAlert();
  const { subscription, getUsage, refreshSubscription } = useSubscription();

  // --- ESTADOS ---
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState(""); // Texto do Loading
  const [planData, setPlanData] = useState<AiPlanResponse | null>(null);

  // Configuração (Layout mantido)
  const [mode, setMode] = useState<1 | 7>(1);
  const [variety, setVariety] = useState<"varied" | "repetitive">("varied");
  const [mealsCount, setMealsCount] = useState(3);

  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [savingMealIndex, setSavingMealIndex] = useState<number | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null);
  const [swapInfo, setSwapInfo] = useState<{ used: number; limit: number | null } | null>(null);
  const [planTitle, setPlanTitle] = useState("");

  // Cota de geração de cardápio depende do plano e do modo (1 ou 7 dias) escolhido
  const planEventType =
    subscription?.plan === "starter"
      ? "generate_plan_starter"
      : mode === 7
        ? "generate_plan_weekly"
        : "generate_plan_daily";
  const planUsage = getUsage(planEventType);
  const planLimitReached = planUsage ? planUsage.used >= (planUsage.limit ?? Infinity) : false;

  // --- NOVOS ESTADOS DO MODAL ---
  const [shoppingModalOpen, setShoppingModalOpen] = useState(false);
  const [shoppingItems, setShoppingItems] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [listTitle, setListTitle] = useState("Minha Lista");

  // 1. PERSISTÊNCIA (Carregar ao abrir)
  useEffect(() => {
    const savedPlan = localStorage.getItem("nutri_current_plan");
    if (savedPlan) {
      try {
        const parsed = JSON.parse(savedPlan);
        // Checagem de segurança: É um plano válido e tem a lista de dias?
        if (parsed && Array.isArray(parsed.days)) {
          setPlanData(parsed);
          setPlanTitle(
            parsed.days.length > 1 ? "Cardápio Semanal (IA)" : "Cardápio do Dia (IA)",
          );
        } else {
          // Se for lixo no localStorage, limpa para não quebrar a tela
          localStorage.removeItem("nutri_current_plan");
        }
      } catch (e) {
        console.error("Erro ao fazer parse do plano salvo");
        localStorage.removeItem("nutri_current_plan");
        console.error(e);
      }
    }
  }, []);

  // 2. GERAR CARDÁPIO (Com salvamento local)
  async function handleGenerate() {
    setLoading(true);
    setLoadingText("A IA está criando sua estratégia nutricional...");
    setPlanData(null); // Limpa resquícios por segurança

    try {
      const response = await api.post("/ai/generate-plan", {
        days: mode,
        variety: variety,
        meals_count: mealsCount,
      });

      if (response && response.data && Array.isArray(response.data.days)) {
        setPlanData(response.data);
        localStorage.setItem(
          "nutri_current_plan",
          JSON.stringify(response.data),
        );
        setSelectedDayIndex(0);
        setPlanTitle(mode === 7 ? "Cardápio Semanal (IA)" : "Cardápio do Dia (IA)");
        setSwapInfo(null);
      } else {
        throw new Error("IA retornou um formato de plano inválido");
      }
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      if (detail?.code === "PLAN_LIMIT_REACHED") {
        showAlert(detail.message, "warning");
      } else {
        showAlert(
          "Erro ao gerar plano. O servidor ou a IA podem estar indisponíveis.",
          "error",
        );
      }
      console.error("Erro no Generate Plan:", error);
      // Se falhar, tenta restaurar o que tinha no localStorage
      const savedPlan = localStorage.getItem("nutri_current_plan");
      if (savedPlan) setPlanData(JSON.parse(savedPlan));
    } finally {
      setLoading(false);
      refreshSubscription();
    }
  }

  // Função para limpar o plano (Botão Novo Plano)
  async function handleClearPlan() {
    if (await confirmDialog("Deseja criar um novo plano? O atual será perdido.")) {
      setPlanData(null);
      localStorage.removeItem("nutri_current_plan");
    }
  }

  // 3. SALVAR RECEITA (Com Flag 'is_new')
  async function handleSaveMeal(
    mealName: string,
    suggestion: string,
    index: number,
    mealCategory?: string,
  ) {
    setSavingMealIndex(index);
    try {
      const aiResponse = await api.post("/ai/recipe-by-ingredients", {
        ingredients: [suggestion],
      });

      if (!aiResponse || !aiResponse.data) {
        throw new Error("A IA falhou em estruturar a receita.");
      }

      const fullRecipe = aiResponse.data;
      // Prioriza a categoria já vinda do cardápio gerado (mais precisa, sabe o
      // horário real da refeição); cai pro heurístico de nome só como proteção
      // contra um plano antigo salvo no localStorage sem o campo "category".
      let cat = mealCategory || fullRecipe.category || "almoco";
      if (!mealCategory && !fullRecipe.category) {
        const n = mealName.toLowerCase();
        if (n.includes("café") || n.includes("cafe")) cat = "cafe_da_manha";
        else if (n.includes("lanche")) cat = "lanche";
        else if (n.includes("jantar")) cat = "jantar";
        else if (n.includes("ceia")) cat = "ceia";
      }

      const saveRes = await api.post("/recipes/", {
        ...fullRecipe,
        title: `${mealName}: ${fullRecipe.title}`,
        category: cat,
        is_new: true,
        is_ai: true,
      });

      if (saveRes && saveRes.data) {
        showAlert(`Receita salva em "${cat}"!`, "success");
      }
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      if (detail?.code === "PLAN_LIMIT_REACHED") {
        showAlert(detail.message, "warning");
      } else {
        showAlert("Erro ao salvar receita. A conexão falhou.", "error");
      }
      console.error(error);
    } finally {
      setSavingMealIndex(null);
      refreshSubscription();
    }
  }

  // 3.5 TROCAR REFEIÇÃO (limite por plano — Starter bloqueado, Plus até 2 por cardápio)
  async function handleSwapMeal(index: number) {
    if (!planData || !currentDay) return;

    if (subscription?.plan === "starter") {
      showAlert(
        "Troca de refeições disponível a partir do plano Plus. Faça upgrade pra desbloquear.",
        "warning",
      );
      return;
    }

    const meal = currentDay.meals[index];
    setSwappingIndex(index);
    try {
      const avoidSuggestions = currentDay.meals
        .filter((_, i) => i !== index)
        .map((m) => m.suggestion);
      const caloriesPerMeal = currentDay.calories_target / currentDay.meals.length;

      const res = await api.post("/ai/swap-meal", {
        plan_token: planData.plan_token,
        slot_name: meal.name,
        calories_target: caloriesPerMeal,
        current_suggestion: meal.suggestion,
        avoid_suggestions: avoidSuggestions,
      });

      const updatedPlan: AiPlanResponse = {
        ...planData,
        days: planData.days.map((d, di) =>
          di === selectedDayIndex
            ? {
                ...d,
                meals: d.meals.map((m, mi) =>
                  mi === index ? { ...m, suggestion: res.data.suggestion } : m,
                ),
              }
            : d,
        ),
      };
      setPlanData(updatedPlan);
      localStorage.setItem("nutri_current_plan", JSON.stringify(updatedPlan));
      setSwapInfo({ used: res.data.swaps_used, limit: res.data.swaps_limit });
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      if (detail?.code === "PLAN_LIMIT_REACHED") {
        showAlert(detail.message, "warning");
      } else {
        showAlert("Erro ao trocar a refeição. Tente novamente.", "error");
      }
      console.error(error);
    } finally {
      setSwappingIndex(null);
    }
  }

  // 4. PREPARAR LISTA (Abre o Modal)
  async function handlePrepareShoppingList() {
    if (!planData) return;
    setLoading(true);
    setLoadingText("Lendo ingredientes do cardápio...");
    try {
      const res = await api.post("/ai/plan-to-shopping-list", planData);

      if (res && res.data) {
        // Blindagem contra items indefinidos
        const items = Array.isArray(res.data.items) ? res.data.items : [];
        setShoppingItems(items);
        setListTitle(res.data.title || "Compras da Semana");
        setSelectedItems(new Set(items));
        setShoppingModalOpen(true);
      } else {
        throw new Error("Resposta vazia da IA ao gerar lista");
      }
    } catch (error) {
      showAlert("Erro ao analisar ingredientes com a IA.", "error");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  // 4.5 SALVAR O CARDÁPIO GERADO COMO UM PLANO ALIMENTAR
  async function handleSavePlan() {
    if (!planData) return;
    setSavingPlan(true);
    try {
      const payload = {
        title: planTitle.trim() || (mode === 7 ? "Cardápio Semanal (IA)" : "Cardápio do Dia (IA)"),
        source: "ai",
        days: planData.days.map((d, i) => ({
          day_label: d.day,
          day_index: i,
          calories_target: d.calories_target,
          macros_protein: d.macros.protein,
          macros_carbs: d.macros.carbs,
          macros_fats: d.macros.fats,
          meals: d.meals.map((m) => ({
            slot_name: m.name,
            custom_title: m.name,
            custom_description: m.suggestion,
          })),
        })),
      };
      await api.post("/meal-plans/", payload);
      showAlert("Plano salvo em 'Planos Alimentares'!", "success");
    } catch (error) {
      showAlert("Erro ao salvar o plano.", "error");
      console.error(error);
    } finally {
      setSavingPlan(false);
    }
  }

  // 5. SALVAR LISTA FINAL (Do Modal para o Banco)
  async function handleFinalizeShoppingList() {
    setLoading(true);
    setLoadingText("Salvando lista de compras...");
    try {
      const listRes = await api.post("/shopping/", { title: listTitle });

      if (listRes && listRes.data && listRes.data.id) {
        const listId = listRes.data.id;
        const itemsToSave = Array.from(selectedItems);

        // Se um item der erro, não derruba os outros
        await Promise.all(
          itemsToSave.map((name) =>
            api
              .post(`/shopping/${listId}/items`, { name })
              .catch((err) =>
                console.error(`Erro ao salvar item ${name}`, err),
              ),
          ),
        );

        setShoppingModalOpen(false);
        navigate("/shopping");
      } else {
        throw new Error("Falha ao criar identificador da lista no banco");
      }
    } catch (error) {
      showAlert("Erro ao salvar lista no banco de dados.", "error");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  function toggleItem(item: string) {
    const newSet = new Set(selectedItems);
    if (newSet.has(item)) newSet.delete(item);
    else newSet.add(item);
    setSelectedItems(newSet);
  }

  const currentDay: DailyPlan | undefined = planData?.days[selectedDayIndex];

  return (
    <div className="max-w-5xl mx-auto relative">
      {/* OVERLAY DE LOADING (com dicas rotativas) */}
      {loading && <LoadingOverlay text={loadingText} />}
      {swappingIndex !== null && <LoadingOverlay text="Trocando a refeição..." />}

      {/* Header (Layout original) */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate("/dashboard")}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
        >
          <ArrowLeft className="h-6 w-6 text-zinc-500" />
        </button>
        <h1 className="text-2xl font-bold text-purple-500 flex items-center gap-2">
          <Sparkles className="h-6 w-6" /> NutriAgent AI
        </h1>
      </div>

      {/* TELA DE CONFIGURAÇÃO (Layout original mantido) */}
      {!planData && !loading && (
        <div className="flex flex-col items-center justify-center py-8 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 border-dashed text-center px-4 shadow-sm">
          <div className="bg-purple-100 dark:bg-purple-500/10 p-4 rounded-full mb-4">
            <Calendar className="h-10 w-10 text-purple-600 dark:text-purple-500" />
          </div>
          <h2 className="text-2xl font-bold dark:text-white mb-6">
            Configure seu Plano
          </h2>

          <div className="w-full max-w-md space-y-6">
            <div>
              <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2 block">
                Duração
              </label>
              <div className="grid grid-cols-2 gap-2 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                <button
                  onClick={() => setMode(1)}
                  className={`py-2 rounded-md text-sm font-medium transition-all ${mode === 1 ? "bg-white dark:bg-zinc-700 shadow text-purple-600 dark:text-white" : "text-zinc-500 dark:text-zinc-400"}`}
                >
                  1 Dia
                </button>
                <button
                  onClick={() => setMode(7)}
                  className={`py-2 rounded-md text-sm font-medium transition-all ${mode === 7 ? "bg-white dark:bg-zinc-700 shadow text-purple-600 dark:text-white" : "text-zinc-500 dark:text-zinc-400"}`}
                >
                  7 Dias
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2 block">
                Refeições por dia
              </label>
              <div className="grid grid-cols-4 gap-2 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                {[3, 4, 5, 6].map((count) => (
                  <button
                    key={count}
                    onClick={() => setMealsCount(count)}
                    className={`py-2 rounded-md text-sm font-medium transition-all ${mealsCount === count ? "bg-white dark:bg-zinc-700 shadow text-purple-600 dark:text-white font-bold" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900"}`}
                  >
                    {count}
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-400 mt-2">
                {mealsCount === 3 && "Café, Almoço, Jantar"}
                {mealsCount === 4 && "Café, Almoço, Lanche, Jantar"}
                {mealsCount === 5 && "Café, Lanche, Almoço, Lanche, Jantar"}
                {mealsCount === 6 &&
                  "Café, Lanche, Almoço, Lanche, Jantar, Ceia"}
              </p>
            </div>

            {mode === 7 && (
              <div className="animate-fadeIn">
                <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2 block">
                  Estilo de Cardápio
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setVariety("varied")}
                    className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${variety === "varied" ? "border-purple-500 bg-purple-50 dark:bg-purple-500/10" : "border-zinc-200 dark:border-zinc-800 hover:border-purple-300"}`}
                  >
                    <Shuffle
                      className={`h-6 w-6 mb-2 ${variety === "varied" ? "text-purple-600" : "text-zinc-400"}`}
                    />
                    <span className="font-bold text-sm dark:text-white">
                      Variedade Total
                    </span>
                  </button>
                  <button
                    onClick={() => setVariety("repetitive")}
                    className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${variety === "repetitive" ? "border-purple-500 bg-purple-50 dark:bg-purple-500/10" : "border-zinc-200 dark:border-zinc-800 hover:border-purple-300"}`}
                  >
                    <Repeat
                      className={`h-6 w-6 mb-2 ${variety === "repetitive" ? "text-purple-600" : "text-zinc-400"}`}
                    />
                    <span className="font-bold text-sm dark:text-white">
                      Praticidade
                    </span>
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={planLimitReached}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap className="h-5 w-5 fill-current" /> Gerar Agora
            </button>
            {planUsage && planUsage.limit !== null && (
              <p className="text-xs text-zinc-400 text-center mt-2">
                {planUsage.used}/{planUsage.limit} cardápios usados nos últimos {planUsage.window_days} dias
                {planLimitReached && (
                  <>
                    {" "}—{" "}
                    <button onClick={() => navigate("/planos")} className="text-purple-500 hover:underline font-medium">
                      fazer upgrade
                    </button>
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      )}

      {/* RESULTADO (Layout original mantido) */}
      {planData && currentDay && (
        <div className="space-y-6 animate-fadeIn pb-20">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-500" />
              {currentDay.day}
            </h2>
            {planData.days.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                <span className="text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                  Dia {selectedDayIndex + 1} de 7
                </span>{" "}
                {planData.days.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedDayIndex(i)}
                    className={`px-3 py-1 rounded-full text-xs ${selectedDayIndex === i ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
                  >
                    {d.day}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center border-l-4 border-l-red-500 shadow-sm">
              <Target className="h-6 w-6 text-red-500 mb-2" />
              <span className="text-2xl font-bold dark:text-white">
                {currentDay.calories_target}
              </span>
              <span className="text-xs text-zinc-500 uppercase tracking-wider">
                Kcal
              </span>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center shadow-sm">
              <span className="text-xl font-bold text-blue-500">
                {currentDay.macros.protein}
              </span>
              <span className="text-xs text-zinc-500 uppercase">Proteína</span>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center shadow-sm">
              <span className="text-xl font-bold text-yellow-500">
                {currentDay.macros.carbs}
              </span>
              <span className="text-xs text-zinc-500 uppercase">Carbo</span>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center shadow-sm">
              <span className="text-xl font-bold text-orange-500">
                {currentDay.macros.fats}
              </span>
              <span className="text-xs text-zinc-500 uppercase">Gordura</span>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/30 flex items-center justify-between">
              <h3 className="font-semibold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
                <Utensils className="h-5 w-5 text-purple-500" /> Cardápio
                Sugerido
              </h3>
              {subscription?.plan === "plus" && swapInfo && swapInfo.limit !== null && (
                <span className="text-xs text-zinc-400">
                  {swapInfo.used}/{swapInfo.limit} trocas usadas
                </span>
              )}
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {currentDay.meals.map((meal, idx) => (
                <div
                  key={idx}
                  className="p-6 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors flex flex-col md:flex-row gap-4 justify-between items-start"
                >
                  <div>
                    <h4 className="text-purple-600 dark:text-purple-400 font-bold mb-2 text-sm uppercase tracking-wide">
                      {meal.name}
                    </h4>
                    <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed text-sm">
                      {meal.suggestion}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => handleSwapMeal(idx)}
                      disabled={swappingIndex === idx}
                      className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-purple-600 hover:text-white text-zinc-500 dark:text-zinc-400 px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                    >
                      {swappingIndex === idx ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Shuffle className="h-4 w-4" />
                      )}
                      {swappingIndex === idx ? "Trocando..." : "Trocar"}
                    </button>
                    <button
                      onClick={() =>
                        handleSaveMeal(meal.name, meal.suggestion, idx, meal.category)
                      }
                      disabled={savingMealIndex === idx}
                      className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-green-600 hover:text-white text-zinc-500 dark:text-zinc-400 px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                    >
                      {savingMealIndex === idx ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {savingMealIndex === idx ? "Salvando..." : "Salvar Receita"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 p-6 rounded-xl flex gap-4 items-start">
            <Lightbulb className="h-6 w-6 text-purple-500 dark:text-purple-400 shrink-0 mt-1" />
            <div>
              <h4 className="font-bold text-purple-700 dark:text-purple-400 mb-1">
                Dica do NutriAgent
              </h4>
              <p className="text-purple-700/80 dark:text-purple-200/80 text-sm italic">
                "{currentDay.tip}"
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <label className="text-sm text-zinc-500 dark:text-zinc-400 flex gap-2 mb-2">
              <Edit3 className="h-4 w-4" /> Nome do plano
            </label>
            <input
              type="text"
              value={planTitle}
              onChange={(e) => setPlanTitle(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none dark:text-white focus:ring-2 focus:ring-teal-500"
              placeholder="Nome do plano"
            />
          </div>

          {/* BOTÕES DE AÇÃO (Com o novo handlePrepareShoppingList) */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleSavePlan}
              disabled={savingPlan}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {savingPlan ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Save className="h-5 w-5" />
              )}
              Salvar Plano
            </button>
            <button
              onClick={handlePrepareShoppingList}
              className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <ShoppingCart className="h-5 w-5" /> Gerar Lista de Compras
            </button>
            <button
              onClick={handleClearPlan}
              className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 py-3 rounded-lg transition-colors"
            >
              Gerar Novo Plano
            </button>
          </div>
        </div>
      )}

      {/* --- MODAL DE SELEÇÃO DE COMPRAS (Novo e Bonito) --- */}
      {shoppingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[85vh]">
            {/* Header Modal */}
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 rounded-t-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-pink-500" /> Confirmar
                  Lista
                </h3>
                <button
                  onClick={() => setShoppingModalOpen(false)}
                  className="text-zinc-500 hover:text-zinc-800 dark:hover:text-white"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Input de Título */}
              <div className="relative">
                <Edit3 className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  value={listTitle}
                  onChange={(e) => setListTitle(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg py-2 pl-9 pr-4 dark:text-white focus:ring-2 focus:ring-pink-500 outline-none text-sm shadow-sm"
                  placeholder="Nome da Lista"
                />
              </div>
            </div>

            {/* Lista Scrollável */}
            <div className="p-6 overflow-y-auto">
              <p className="text-sm text-zinc-500 mb-4">
                Selecione o que você precisa comprar:
              </p>
              <div className="space-y-2">
                {shoppingItems.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => toggleItem(item)}
                    className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                  >
                    {selectedItems.has(item) ? (
                      <CheckSquare className="h-5 w-5 text-pink-500 shrink-0" />
                    ) : (
                      <Square className="h-5 w-5 text-zinc-400 shrink-0" />
                    )}
                    <span
                      className={
                        selectedItems.has(item)
                          ? "text-zinc-900 dark:text-zinc-100 font-medium"
                          : "text-zinc-400 line-through"
                      }
                    >
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Ação */}
            <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 rounded-b-2xl">
              <button
                onClick={handleFinalizeShoppingList}
                className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 rounded-lg flex justify-center gap-2 shadow-lg shadow-pink-900/20"
              >
                Salvar Lista ({selectedItems.size} itens)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
