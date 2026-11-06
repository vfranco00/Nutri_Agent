import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import { useSubscription } from "../lib/SubscriptionContext";
import { NuviLoader } from "../components/brand/NuviLoader";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Sheet } from "../components/ui/Sheet";
import { ROUTES } from "../routes";
import type { AiPlanResponse, DailyPlan } from "../types";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Info,
  Lightbulb,
  Loader2,
  Repeat,
  Save,
  Shuffle,
  ShoppingCart,
  Sparkles,
} from "lucide-react";

type DetalheErro = { code?: string; message?: string } | undefined;
function detalheDoErro(error: unknown): DetalheErro {
  return (error as { response?: { data?: { detail?: DetalheErro } } }).response?.data?.detail;
}

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
  const [savedMealKeys, setSavedMealKeys] = useState<Set<string>>(new Set());
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
    const savedPlan = localStorage.getItem("nuvi_current_plan");
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
          localStorage.removeItem("nuvi_current_plan");
        }
      } catch (e) {
        console.error("Erro ao fazer parse do plano salvo");
        localStorage.removeItem("nuvi_current_plan");
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
          "nuvi_current_plan",
          JSON.stringify(response.data),
        );
        setSelectedDayIndex(0);
        setPlanTitle(mode === 7 ? "Cardápio Semanal (IA)" : "Cardápio do Dia (IA)");
        setSwapInfo(null);
      } else {
        throw new Error("IA retornou um formato de plano inválido");
      }
    } catch (error) {
      const detail = detalheDoErro(error);
      if (detail?.code === "PLAN_LIMIT_REACHED") {
        showAlert(detail.message ?? "Limite do plano atingido.", "warning");
      } else {
        showAlert(
          "Erro ao gerar plano. O servidor ou a IA podem estar indisponíveis.",
          "error",
        );
      }
      console.error("Erro no Generate Plan:", error);
      // Se falhar, tenta restaurar o que tinha no localStorage
      const savedPlan = localStorage.getItem("nuvi_current_plan");
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
      localStorage.removeItem("nuvi_current_plan");
    }
  }

  // 3. SALVAR RECEITA (Com Flag 'is_new')
  async function handleSaveMeal(
    mealName: string,
    suggestion: string,
    index: number,
    mealCategory?: string,
  ) {
    const mealKey = `${selectedDayIndex}-${index}`;
    if (savingMealIndex !== null || savedMealKeys.has(mealKey)) return;
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
        // Ver AiChef.tsx: o backend deixou de forçar is_public, então a escolha
        // precisa ser dita aqui. Mantém o comportamento atual (vai pra comunidade).
        is_public: true,
      });

      if (saveRes && saveRes.data) {
        showAlert(`Receita salva em "${cat}"!`, "success");
        setSavedMealKeys((prev) => new Set(prev).add(mealKey));
      }
    } catch (error) {
      const detail = detalheDoErro(error);
      if (detail?.code === "PLAN_LIMIT_REACHED") {
        showAlert(detail.message ?? "Limite do plano atingido.", "warning");
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
      localStorage.setItem("nuvi_current_plan", JSON.stringify(updatedPlan));
      setSwapInfo({ used: res.data.swaps_used, limit: res.data.swaps_limit });
      // A sugestão mudou — se essa refeição já tinha sido salva antes da troca,
      // o "Salva" ficaria mentindo sobre uma receita que não existe mais.
      setSavedMealKeys((prev) => {
        const next = new Set(prev);
        next.delete(`${selectedDayIndex}-${index}`);
        return next;
      });
    } catch (error) {
      const detail = detalheDoErro(error);
      if (detail?.code === "PLAN_LIMIT_REACHED") {
        showAlert(detail.message ?? "Limite do plano atingido.", "warning");
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
    if (!subscription?.shopping_list_access) {
      showAlert(
        "Lista de compras disponível a partir do plano Plus. Faça upgrade pra desbloquear.",
        "warning",
      );
      return;
    }
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
        navigate(ROUTES.compras);
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

  const CHIP = (ativo: boolean) =>
    `whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] font-bold active:scale-[.97] ${ativo ? "bg-ink text-bg" : "bg-card text-ink"}`;

  return (
    <div className="relative mx-auto max-w-3xl space-y-1">
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
          Monte meu <span className="text-act-text">cardápio</span>
        </h1>
      </div>

      {/* CARREGANDO: a onda do Nuvi (só aparece se passar de 300 ms) */}
      {loading && (
        <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center"
        >
          <NuviLoader active size={96} label={loadingText} />
          <p className="mt-4 text-[22px] font-black leading-tight">
            {planData ? "Lendo seu " : "Montando seu "}
            <span className="text-act-text">cardápio</span>…
          </p>
          <p className="mt-1.5 font-semibold text-mut">{loadingText}</p>
        </div>
      )}

      {/* CONFIGURAÇÃO */}
      {!planData && !loading && (
        <div className="space-y-1">
          <p className="px-1 text-[13px] font-semibold text-mut">o Agente usa seu perfil e o que você gosta</p>

          <h2 className="px-1 pb-1 pt-3 text-base font-extrabold">Para quantos dias?</h2>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" aria-pressed={mode === 1} onClick={() => setMode(1)} className={CHIP(mode === 1)}>
              1 dia
            </button>
            <button type="button" aria-pressed={mode === 7} onClick={() => setMode(7)} className={CHIP(mode === 7)}>
              7 dias
            </button>
          </div>

          <h2 className="px-1 pb-1 pt-3 text-base font-extrabold">Refeições por dia</h2>
          <div className="flex flex-wrap gap-1.5">
            {[3, 4, 5, 6].map((count) => (
              <button
                key={count}
                type="button"
                aria-pressed={mealsCount === count}
                onClick={() => setMealsCount(count)}
                className={CHIP(mealsCount === count)}
              >
                {count} refeições
              </button>
            ))}
          </div>
          <p className="px-1 pt-1 text-xs text-mut">
            {mealsCount === 3 && "Café, Almoço, Jantar"}
            {mealsCount === 4 && "Café, Almoço, Lanche, Jantar"}
            {mealsCount === 5 && "Café, Lanche, Almoço, Lanche, Jantar"}
            {mealsCount === 6 && "Café, Lanche, Almoço, Lanche, Jantar, Ceia"}
          </p>

          {mode === 7 && (
            <>
              <h2 className="px-1 pb-1 pt-3 text-base font-extrabold">Estilo de cardápio</h2>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  aria-pressed={variety === "varied"}
                  onClick={() => setVariety("varied")}
                  className={`${CHIP(variety === "varied")} flex items-center gap-1.5`}
                >
                  <Shuffle className="h-4 w-4" aria-hidden="true" /> Variedade total
                </button>
                <button
                  type="button"
                  aria-pressed={variety === "repetitive"}
                  onClick={() => setVariety("repetitive")}
                  className={`${CHIP(variety === "repetitive")} flex items-center gap-1.5`}
                >
                  <Repeat className="h-4 w-4" aria-hidden="true" /> Praticidade
                </button>
              </div>
            </>
          )}

          {planUsage && planUsage.limit !== null && (
            <p className="flex items-center gap-1.5 px-1 pt-4 text-[12.5px] font-semibold text-mut">
              <Info className="h-[15px] w-[15px]" aria-hidden="true" />
              {planUsage.used}/{planUsage.limit} cardápios usados nos últimos {planUsage.window_days} dias
              {planLimitReached && (
                <>
                  {" — "}
                  <button type="button" onClick={() => navigate(ROUTES.assinatura)} className="font-bold text-act-text">
                    fazer upgrade
                  </button>
                </>
              )}
            </p>
          )}

          <div className="pt-4">
            <Button onClick={handleGenerate} disabled={planLimitReached} className="w-full py-3.5 text-base">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
              Gerar cardápio de {mode} {mode > 1 ? "dias" : "dia"}
            </Button>
          </div>
        </div>
      )}

      {/* RESULTADO */}
      {planData && currentDay && !loading && (
        <div className="space-y-2 pb-6">
          <p className="px-1 text-[13px] font-semibold text-mut">
            {planData.days.length} {planData.days.length > 1 ? "dias" : "dia"} · ~{currentDay.calories_target} kcal/dia
          </p>

          {planData.days.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto py-1">
              {planData.days.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={selectedDayIndex === i}
                  onClick={() => setSelectedDayIndex(i)}
                  className={`shrink-0 ${CHIP(selectedDayIndex === i)}`}
                >
                  {d.day}
                </button>
              ))}
            </div>
          )}

          <section className="rounded-3xl bg-card px-4 py-3.5">
            <div className="flex items-baseline justify-between">
              <b className="text-[15px]">{currentDay.day}</b>
              <span className="text-[26px] font-black tabular-nums">
                {currentDay.calories_target} <span className="text-xs font-bold text-mut">kcal</span>
              </span>
            </div>
            <div className="mt-2 flex gap-2">
              {[
                [currentDay.macros.protein, "Proteína"],
                [currentDay.macros.carbs, "Carbo"],
                [currentDay.macros.fats, "Gordura"],
              ].map(([v, nome]) => (
                <div key={nome} className="flex-1 rounded-2xl bg-soft px-2 py-2.5 text-center text-[11.5px] text-mut">
                  <b className="block text-[14.5px] text-ink">{v}</b>
                  {nome}
                </div>
              ))}
            </div>
          </section>

          <div className="flex items-center justify-between px-1 pt-2">
            <h2 className="text-base font-extrabold">Cardápio sugerido</h2>
            {subscription?.plan === "plus" && swapInfo && swapInfo.limit !== null && (
              <span className="text-xs text-mut">
                {swapInfo.used}/{swapInfo.limit} trocas usadas
              </span>
            )}
          </div>
          <ul className="space-y-2">
            {currentDay.meals.map((meal, idx) => {
              const salva = savedMealKeys.has(`${selectedDayIndex}-${idx}`);
              return (
                <li key={idx} className="rounded-[22px] bg-card px-4 py-3.5">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-act-text">{meal.name}</h3>
                  <p className="mt-1 text-sm leading-relaxed">{meal.suggestion}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleSwapMeal(idx)}
                      disabled={swappingIndex === idx}
                      className="px-3 py-1.5 text-xs"
                    >
                      {swappingIndex === idx ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Shuffle className="h-4 w-4" aria-hidden="true" />
                      )}
                      {swappingIndex === idx ? "Trocando..." : "Trocar"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleSaveMeal(meal.name, meal.suggestion, idx, meal.category)}
                      disabled={savingMealIndex === idx || salva}
                      className="px-3 py-1.5 text-xs"
                    >
                      {savingMealIndex === idx ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : salva ? (
                        <CheckCircle2 className="h-4 w-4 text-pos-text" aria-hidden="true" />
                      ) : (
                        <Save className="h-4 w-4" aria-hidden="true" />
                      )}
                      {savingMealIndex === idx ? "Salvando..." : salva ? "Salva" : "Salvar receita"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex items-start gap-3 rounded-3xl bg-act-soft p-4">
            <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-act-text" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-extrabold">Dica do Nuvi</h3>
              <p className="mt-0.5 text-sm italic text-ink/80">“{currentDay.tip}”</p>
            </div>
          </div>

          <div className="rounded-3xl bg-card p-4">
            <label htmlFor="plano-titulo" className="mb-1.5 block text-xs font-bold text-mut">
              Nome do plano
            </label>
            <Input
              id="plano-titulo"
              type="text"
              value={planTitle}
              onChange={(e) => setPlanTitle(e.target.value)}
              placeholder="Nome do plano"
            />
          </div>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <Button onClick={handleSavePlan} disabled={savingPlan} className="flex-1">
              {savingPlan ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="h-5 w-5" aria-hidden="true" />
              )}
              Salvar plano
            </Button>
            <Button variant="outline" onClick={handlePrepareShoppingList} className="flex-1">
              <ShoppingCart className="h-5 w-5" aria-hidden="true" /> Gerar lista de compras
            </Button>
            <Button variant="ghost" onClick={handleClearPlan} className="flex-1">
              Gerar novo plano
            </Button>
          </div>
        </div>
      )}

      {/* SELEÇÃO DE COMPRAS */}
      <Sheet open={shoppingModalOpen} onOpenChange={setShoppingModalOpen} title="Confirmar lista">
        <label htmlFor="lista-titulo" className="mb-1.5 block text-xs font-bold text-mut">
          Nome da lista
        </label>
        <Input
          id="lista-titulo"
          type="text"
          value={listTitle}
          onChange={(e) => setListTitle(e.target.value)}
          placeholder="Nome da Lista"
        />
        <p className="mb-2 mt-4 text-sm text-mut">Selecione o que você precisa comprar:</p>
        <ul className="overflow-hidden rounded-[22px] bg-bg">
          {shoppingItems.map((item, idx) => {
            const marcado = selectedItems.has(item);
            return (
              <li key={idx} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={marcado}
                  onClick={() => toggleItem(item)}
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
                >
                  <span
                    className={`flex h-6 w-6 flex-none items-center justify-center rounded-lg border-2 ${
                      marcado ? "border-pos bg-pos text-nuvi-tinta" : "border-line"
                    }`}
                  >
                    {marcado && <Check className="h-[15px] w-[15px]" aria-hidden="true" />}
                  </span>
                  <span className={marcado ? "text-sm font-bold" : "text-sm text-mut line-through"}>{item}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <Button onClick={handleFinalizeShoppingList} className="mt-4 w-full py-3">
          Salvar lista ({selectedItems.size} itens)
        </Button>
      </Sheet>
    </div>
  );
}
