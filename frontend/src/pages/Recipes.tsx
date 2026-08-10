import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import { useSubscription } from "../lib/SubscriptionContext";
import { cleanMarkdown, formatInstructions } from "../lib/utils";
import { BouncingDots } from "../components/BouncingDots";
import { type Recipe, CATEGORIES, type LeaderboardEntry } from "../types";
import {
  Plus,
  Clock,
  Flame,
  ChefHat,
  Trash2,
  Loader2,
  X,
  Edit2,
  Save,
  Carrot,
  Volume2,
  Square,
  Star,
  Target,
  Trophy,
  Bot,
  Crown,
  User as UserIcon,
} from "lucide-react";

interface EditFormData {
  title: string;
  instructions: string;
  prep_time: number;
  calories: number;
  preparation_method: string;
  category: string;
  // Adicionei a tipagem dos ingredientes no form
  ingredients: {
    name: string;
    quantity: number;
    unit: string;
    calories?: number;
  }[];
}

export function Recipes() {
  const navigate = useNavigate();
  const { showAlert, confirmDialog } = useAlert();
  const { subscription } = useSubscription();
  const atRecipeLimit =
    subscription?.max_saved_recipes !== null &&
    subscription?.max_saved_recipes !== undefined &&
    subscription.saved_recipes_used >= subscription.max_saved_recipes;

  // ESTADOS
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"mine" | "community">("mine");
  const [recommendations, setRecommendations] = useState<Recipe[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Estados do Modal
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditFormData>({
    title: "",
    instructions: "",
    prep_time: 0,
    calories: 0,
    preparation_method: "",
    category: "almoco",
    ingredients: [],
  });

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // CARREGAR DADOS
  async function loadRecipes() {
    setLoading(true);
    try {
      const endpoint = viewMode === "mine" ? "/recipes/" : "/recipes/public";
      const response = await api.get(endpoint);
      
      // Checagem de segurança: Existe response? Existe data? É um array?
      if (response && Array.isArray(response.data)) {
        setRecipes(response.data);
      } else {
        setRecipes([]); // Fallback seguro
      }
    } catch (error) {
      console.error("Erro ao carregar receitas:", error);
      setRecipes([]); // Se der erro 404, 500, ou CORS, garante que não quebre o .map()
    } finally {
      setLoading(false);
    }
  }

  // 1. Recarrega as receitas sempre que mudar a aba (viewMode)
  useEffect(() => {
    loadRecipes();
  }, [viewMode]);

  // 2. Cancela a fala quando nenhuma receita está selecionada
  useEffect(() => {
    if (!selectedRecipe) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [selectedRecipe]);

  // 3. Busca dados iniciais
  useEffect(() => {
    const fetchInitialData = async () => {
      // Recomendações
      try {
        const recRes = await api.get("/recipes/recommendations");
        if (recRes && Array.isArray(recRes.data)) {
          setRecommendations(recRes.data);
        } else {
          setRecommendations([]);
        }
      } catch (error) {
        console.warn("Sem recomendações disponíveis no momento.");
        setRecommendations([]);
        console.error("Erro ao buscar recomendações:", error);
      }

      // Leaderboard
      try {
        const leadRes = await api.get("/users/leaderboard");
        if (leadRes && Array.isArray(leadRes.data)) {
          setLeaderboard(leadRes.data);
        } else {
          setLeaderboard([]);
        }
      } catch (error) {
        console.warn("Sem leaderboard disponível no momento.");
        setLeaderboard([]);
        console.error("Erro ao buscar leaderboard:", error);
      }
    };
    
    fetchInitialData();
  }, []);

  // FAVORITAR
  async function toggleFavorite(e: React.MouseEvent, recipe: Recipe) {
    e.stopPropagation();
    if (viewMode === "community") return;

    try {
      const updatedList = recipes.map((r) =>
        r.id === recipe.id ? { ...r, is_favorite: !r.is_favorite } : r,
      );
      setRecipes(updatedList);
      await api.put(`/recipes/${recipe.id}`, {
        ...recipe,
        is_favorite: !recipe.is_favorite,
      });
    } catch (error) {
      showAlert("Erro ao favoritar.", "error");
      console.error(error);
      loadRecipes();
    }
  }

  // ABRIR DETALHES E POPULAR FORMULÁRIO
  async function handleOpenRecipe(recipe: Recipe) {
    setSelectedRecipe(recipe);

    setEditForm({
      title: recipe.title,
      instructions: recipe.instructions,
      prep_time: recipe.prep_time || 0,
      calories: recipe.calories || 0,
      // @ts-ignore
      preparation_method: recipe.preparation_method || "fogao",
      category: recipe.category || "almoco",
      // Mapeia ingredientes para o formato editável
      // @ts-ignore
      ingredients: recipe.ingredients
        ? recipe.ingredients.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            calories: i.calories,
          }))
        : [],
    });

    if (recipe.is_new && viewMode === "mine") {
      try {
        setRecipes((prev) =>
          prev.map((r) => (r.id === recipe.id ? { ...r, is_new: false } : r)),
        );
        await api.put(`/recipes/${recipe.id}`, { ...recipe, is_new: false });
      } catch (error) {
        console.error(error);
      }
    }

    setIsEditing(false);
  }

  function handleCloseModal() {
    setSelectedRecipe(null);
    setIsEditing(false);
  }

  // LOGICA DE EDIÇÃO DE INGREDIENTES
  function updateIngredient(
    index: number,
    field: string,
    value: string | number,
  ) {
    const newIngs = [...editForm.ingredients];
    // @ts-ignore
    newIngs[index][field] = value;
    setEditForm({ ...editForm, ingredients: newIngs });
  }

  function removeIngredient(index: number) {
    const newIngs = editForm.ingredients.filter((_, i) => i !== index);
    setEditForm({ ...editForm, ingredients: newIngs });
  }

  function addIngredient() {
    setEditForm({
      ...editForm,
      ingredients: [
        ...editForm.ingredients,
        { name: "", quantity: 1, unit: "un", calories: 0 },
      ],
    });
  }

  // SALVAR EDIÇÃO
  async function handleSaveEdit() {
    if (!selectedRecipe) return;
    setSavingEdit(true);
    try {
      const res = await api.put(`/recipes/${selectedRecipe.id}`, editForm);
      const updatedRecipe = res.data;
      setRecipes(
        recipes.map((r) => (r.id === selectedRecipe.id ? updatedRecipe : r)),
      );
      setSelectedRecipe(updatedRecipe);
      setIsEditing(false);
      showAlert("Receita atualizada!", "success");
    } catch (error) {
      console.error(error);
      showAlert("Erro ao atualizar.", "error");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(id: number) {
    if (await confirmDialog("Tem certeza que deseja excluir esta receita?", { danger: true })) {
      setDeleting(true);
      try {
        await api.delete(`/recipes/${id}`);
        setRecipes(recipes.filter((r) => r.id !== id));
        handleCloseModal();
      } catch (error) {
        showAlert("Erro ao excluir.", "error");
        console.error(error);
      } finally {
        setDeleting(false);
      }
    }
  }

  function handleSpeak() {
    if (!selectedRecipe) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    // @ts-ignore
    const textToRead = `Receita: ${selectedRecipe.title}. Modo de preparo: ${formatInstructions(cleanMarkdown(selectedRecipe.instructions))}`;
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = "pt-BR";
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }

  // Filtros
  const filteredRecipes =
    filter === "all" ? recipes : recipes.filter((r) => r.category === filter);
  const sortedRecipes = [...filteredRecipes].sort((a, b) => {
    if (a.is_new && !b.is_new) return -1;
    if (!a.is_new && b.is_new) return 1;
    return (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0);
  });

  return (
    <>
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-orange-500">
              {viewMode === "mine" ? "Minhas Receitas" : "Comunidade"}
            </h1>
            {viewMode === "mine" && subscription?.max_saved_recipes != null && (
              <p className="text-xs text-zinc-500 mt-1">
                {subscription.saved_recipes_used}/{subscription.max_saved_recipes} receitas salvas
                {atRecipeLimit && (
                  <>
                    {" "}—{" "}
                    <button onClick={() => navigate("/planos")} className="text-orange-500 hover:underline font-medium">
                      fazer upgrade
                    </button>
                  </>
                )}
              </p>
            )}
          </div>
          <button
            onClick={() =>
              atRecipeLimit
                ? showAlert(
                    `Seu plano permite no máximo ${subscription?.max_saved_recipes} receitas salvas. Faça upgrade pra criar mais.`,
                    "warning",
                  )
                : navigate("/recipes/new")
            }
            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm shrink-0"
          >
            <Plus className="h-5 w-5" />{" "}
            <span className="hidden md:inline">Nova Receita</span>
          </button>
        </div>

        {/* --- ABAS --- */}
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg w-fit">
          <button
            onClick={() => setViewMode("mine")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === "mine" ? "bg-white dark:bg-zinc-800 text-orange-600 shadow-sm" : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400"}`}
          >
            Meus Pratos
          </button>
          <button
            onClick={() => setViewMode("community")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === "community" ? "bg-white dark:bg-zinc-800 text-blue-600 shadow-sm" : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400"}`}
          >
            Comunidade
          </button>
        </div>

        {/* --- LEADERBOARD (Só na Comunidade) --- */}
        {viewMode === "community" && leaderboard.length > 0 && (
          <div className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-xl p-4 mb-2 shadow-lg animate-fadeIn text-white border border-blue-800">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2 text-yellow-400">
              <Trophy className="h-4 w-4" /> Top Chefs da Semana
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {leaderboard.map((user, idx) => (
                <div
                  key={user.id}
                  className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-lg shrink-0"
                >
                  <div className="font-bold text-lg text-yellow-400 w-6">
                    #{idx + 1}
                  </div>
                  <div>
                    <span className="block text-sm font-semibold truncate max-w-[100px]">
                      {user.display_name}
                    </span>
                    <span className="text-xs text-white/60">
                      {user.score} XP
                    </span>
                  </div>
                  {idx === 0 && (
                    <Crown className="h-4 w-4 text-yellow-400 ml-1" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          {Object.entries(CATEGORIES).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${filter === key ? "bg-orange-500 text-white" : "bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:border-orange-500"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* --- CARROSSEL RECOMENDAÇÕES --- */}
      {viewMode === "mine" && recommendations.length > 0 && !loading && (
        <div className="mb-10 animate-fadeIn">
          <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500 mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-orange-500" /> Escolhidas para Você
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
            {recommendations.map((recipe) => (
              <div
                key={recipe.id}
                onClick={() => handleOpenRecipe(recipe)}
                className="min-w-[280px] bg-white dark:bg-zinc-900 border border-orange-100 dark:border-orange-900/30 rounded-xl p-4 cursor-pointer hover:scale-[1.02] transition-transform snap-center shadow-sm"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 text-[10px] font-bold px-2 py-1 rounded uppercase truncate max-w-[120px]">
                    {recipe.category || "Geral"}
                  </span>
                  <span className="text-xs text-zinc-500 flex items-center gap-1 shrink-0">
                    <Flame className="h-3 w-3" />{" "}
                    {Math.round(recipe.calories || 0)}
                  </span>
                </div>
                <h3 className="font-bold text-zinc-800 dark:text-white line-clamp-1 mb-1 text-sm">
                  {recipe.title}
                </h3>
                <p className="text-xs text-zinc-500 line-clamp-2 h-8 leading-relaxed">
                  {formatInstructions(cleanMarkdown(recipe.instructions))}
                </p>
                <div className="mt-3 pt-3 border-t border-dashed border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {recipe.prep_time}m
                  </span>
                  <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-[10px]">
                    Ver receita
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center mt-20">
          <Loader2 className="animate-spin h-8 w-8 text-orange-500" />
        </div>
      )}

      {!loading && sortedRecipes.length === 0 && (
        <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 border-dashed">
          <ChefHat className="h-16 w-16 text-zinc-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold dark:text-zinc-300">
            Nada encontrado
          </h3>
          <p className="text-zinc-500 mt-2">
            {viewMode === "mine"
              ? "Você ainda não tem receitas."
              : "Ainda não há receitas públicas."}
          </p>
        </div>
      )}

      {/* LISTA DE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedRecipes.map((recipe) => (
          <div
            key={recipe.id}
            onClick={() => handleOpenRecipe(recipe)}
            className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-orange-500/50 hover:-translate-y-1 transition-all cursor-pointer group shadow-sm"
          >
            {recipe.is_new && viewMode === "mine" && (
              <div className="absolute -top-2 -left-2 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg z-20 animate-bounce">
                NOVA
              </div>
            )}

            {/* Tag IA */}
            {recipe.is_ai && (
              <div className="absolute top-4 left-4 bg-blue-500/10 text-blue-700 dark:text-blue-500 text-[10px] font-bold px-2 py-1 rounded border border-blue-500/20 flex items-center gap-1">
                <Bot className="h-3 w-3" /> IA
              </div>
            )}

            {viewMode === "mine" && (
              <button
                onClick={(e) => toggleFavorite(e, recipe)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors z-10"
              >
                <Star
                  className={`h-5 w-5 ${recipe.is_favorite ? "fill-yellow-400 text-yellow-400" : "text-zinc-500 dark:text-zinc-600"}`}
                />
              </button>
            )}

            <div className={`flex justify-between items-start mb-3 pr-8 ${recipe.is_ai ? "pt-7" : ""}`}>
              <h3 className="text-lg font-bold dark:text-zinc-100 group-hover:text-orange-500 transition-colors line-clamp-1">
                {recipe.title}
              </h3>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm line-clamp-3 mb-4 h-12">
              {formatInstructions(cleanMarkdown(recipe.instructions))}
            </p>
            <div className="flex items-center gap-4 text-xs text-zinc-500 border-t border-zinc-100 dark:border-zinc-800 pt-4">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {recipe.prep_time}m
              </div>
              <div className="flex items-center gap-1">
                <Flame className="h-3 w-3" />
                {Math.round(recipe.calories || 0)}kcal
              </div>
              {recipe.category && (
                <div className="ml-auto px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500 capitalize">
                  {recipe.category}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* --- MODAL DETALHES --- */}
      {selectedRecipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
              {isEditing ? (
                <input
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm({ ...editForm, title: e.target.value })
                  }
                  className="bg-zinc-100 dark:bg-zinc-800 text-xl font-bold dark:text-white rounded px-2 py-1 w-full mr-4 outline-none focus:ring-2 focus:ring-orange-500"
                />
              ) : (
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold dark:text-white">
                    {selectedRecipe.title}
                  </h2>
                  <button
                    onClick={handleSpeak}
                    className={`p-2 rounded-full transition-colors ${isSpeaking ? "bg-orange-500 text-white animate-pulse" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-orange-500"}`}
                  >
                    {isSpeaking ? (
                      <Square className="h-4 w-4 fill-current" />
                    ) : (
                      <Volume2 className="h-5 w-5" />
                    )}
                  </button>
                </div>
              )}
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Status: Feito por IA ou pelo usuário */}
              {/* @ts-ignore */}
              {selectedRecipe.is_ai ? (
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-500/20">
                  <Bot className="h-3.5 w-3.5" /> Gerado por IA
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-700">
                  <UserIcon className="h-3.5 w-3.5" /> Criado por você
                </div>
              )}

              {/* Campos Tempo e Calorias */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <Clock className="h-4 w-4 text-blue-500" />
                  {isEditing ? (
                    <input
                      type="number"
                      className="w-16 bg-transparent outline-none border-b border-zinc-300 dark:border-zinc-700"
                      value={editForm.prep_time}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          prep_time: Number(e.target.value),
                        })
                      }
                    />
                  ) : (
                    <span>{selectedRecipe.prep_time} min</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <Flame className="h-4 w-4 text-orange-500" />
                  {isEditing ? (
                    <input
                      type="number"
                      className="w-16 bg-transparent outline-none border-b border-zinc-300 dark:border-zinc-700"
                      value={editForm.calories}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          calories: Number(e.target.value),
                        })
                      }
                    />
                  ) : (
                    <span>{Math.round(selectedRecipe.calories || 0)} kcal</span>
                  )}
                </div>
              </div>

              {/* INGREDIENTES COM MODO EDIÇÃO */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-orange-500 uppercase tracking-wider flex items-center gap-2">
                    <Carrot className="h-4 w-4" /> Ingredientes
                  </h3>
                  {isEditing && (
                    <button
                      onClick={addIngredient}
                      className="text-xs text-green-500 flex items-center gap-1 hover:text-green-400"
                    >
                      <Plus className="h-3 w-3" /> Adicionar
                    </button>
                  )}
                </div>

                <ul className="space-y-2">
                  {isEditing
                    ? // MODO EDIÇÃO: Inputs
                      editForm.ingredients.map((ing, i) => (
                        <li key={i} className="flex gap-2 items-center">
                          <input
                            value={ing.name}
                            onChange={(e) =>
                              updateIngredient(i, "name", e.target.value)
                            }
                            className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-sm dark:text-white"
                            placeholder="Nome"
                          />
                          <input
                            type="number"
                            value={ing.quantity}
                            onChange={(e) =>
                              updateIngredient(i, "quantity", e.target.value)
                            }
                            className="w-16 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-sm dark:text-white"
                            placeholder="Qtd"
                          />
                          <input
                            value={ing.unit}
                            onChange={(e) =>
                              updateIngredient(i, "unit", e.target.value)
                            }
                            className="w-16 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-sm dark:text-white"
                            placeholder="Un"
                          />
                          <button
                            onClick={() => removeIngredient(i)}
                            className="text-red-500 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      ))
                    : // MODO VISUALIZAÇÃO
                      // @ts-ignore
                      selectedRecipe.ingredients &&
                      selectedRecipe.ingredients.map((ing) => (
                        <li
                          key={ing.id}
                          className="text-zinc-700 dark:text-zinc-300 text-sm bg-zinc-50 dark:bg-zinc-950/50 p-2 rounded border border-zinc-100 dark:border-zinc-800 flex justify-between items-center"
                        >
                          <span>{ing.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">
                              {ing.calories
                                ? `~${Math.round(ing.calories)}kcal`
                                : ""}
                            </span>
                            <span className="font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-200 dark:bg-zinc-800 px-2 rounded">
                              {ing.quantity} {ing.unit}
                            </span>
                          </div>
                        </li>
                      ))}
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-bold text-orange-500 uppercase tracking-wider">
                  Modo de Preparo
                </h3>
                {isEditing ? (
                  <textarea
                    rows={8}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 dark:text-zinc-300 outline-none resize-none focus:ring-2 focus:ring-orange-500"
                    value={editForm.instructions}
                    onChange={(e) =>
                      setEditForm({ ...editForm, instructions: e.target.value })
                    }
                  />
                ) : (
                  <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {formatInstructions(cleanMarkdown(selectedRecipe.instructions))}
                  </p>
                )}
              </div>
            </div>

            {/* FOOTER AÇÕES */}
            <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 rounded-b-2xl flex justify-between">
              {isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="text-zinc-500 hover:text-zinc-800 dark:hover:text-white px-4 py-2 font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={savingEdit}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
                  >
                    {savingEdit ? <BouncingDots /> : <><Save className="h-4 w-4" /> Salvar</>}
                  </button>
                </>
              ) : (
                <>
                  {viewMode === "mine" && (
                    <>
                      {/* Lógica: Se for IA, bloqueia excluir e mostra badge */}
                      {!selectedRecipe.is_ai ? (
                        <button
                          onClick={() => handleDelete(selectedRecipe.id)}
                          disabled={deleting}
                          className="text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
                        >
                          {deleting ? <BouncingDots /> : <><Trash2 className="h-4 w-4" /> Excluir</>}
                        </button>
                      ) : (
                        <span
                          className="text-zinc-500 text-xs flex items-center gap-1 cursor-not-allowed select-none"
                          title="Gerado por IA (Protegido)"
                        >
                          <Bot className="h-4 w-4" /> Gerada por IA
                        </span>
                      )}

                      <button
                        onClick={() => setIsEditing(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"
                      >
                        <Edit2 className="h-4 w-4" /> Editar
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
