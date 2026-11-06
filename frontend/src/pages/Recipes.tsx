import { rotuloCategoria, rotuloKcal, semDuplicadas } from "../lib/recipeLabels";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Target, ChefHat } from "lucide-react";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import { useSubscription } from "../lib/SubscriptionContext";
import { type Recipe, CATEGORIES } from "../types";
import { PageTitle } from "../components/PageTitle";
import { RecipeCard } from "../components/recipes/RecipeCard";
import { Button } from "../components/ui/Button";
import { Tabs, TabsList, TabsTab } from "../components/ui/Tabs";
import { Skeleton } from "../components/ui/Skeleton";
import { ROUTES } from "../routes";
import { cleanMarkdown, formatInstructions } from "../lib/utils";

type Aba = "todas" | "favoritas";

export function Recipes() {
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  const { subscription } = useSubscription();
  const atRecipeLimit =
    subscription?.max_saved_recipes !== null &&
    subscription?.max_saved_recipes !== undefined &&
    subscription.saved_recipes_used >= subscription.max_saved_recipes;

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [aba, setAba] = useState<Aba>("todas");
  const [recommendations, setRecommendations] = useState<Recipe[]>([]);

  async function loadRecipes() {
    setLoading(true);
    try {
      const response = await api.get("/recipes/");
      setRecipes(response && Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Erro ao carregar receitas:", error);
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecipes();
    (async () => {
      try {
        const recRes = await api.get("/recipes/recommendations");
        setRecommendations(recRes && Array.isArray(recRes.data) ? recRes.data : []);
      } catch (error) {
        console.error("Erro ao buscar recomendações:", error);
        setRecommendations([]);
      }
    })();
  }, []);

  function abrir(recipe: Recipe) {
    navigate(ROUTES.receita(recipe.id), { state: { recipe, mine: true } });
  }

  async function toggleFavorite(e: React.MouseEvent, recipe: Recipe) {
    e.stopPropagation();
    try {
      setRecipes(recipes.map((r) => (r.id === recipe.id ? { ...r, is_favorite: !r.is_favorite } : r)));
      await api.put(`/recipes/${recipe.id}`, { ...recipe, is_favorite: !recipe.is_favorite });
    } catch (error) {
      showAlert("Erro ao favoritar.", "error");
      console.error(error);
      loadRecipes();
    }
  }

  const filtered = recipes
    .filter((r) => (filter === "all" ? true : r.category === filter))
    .filter((r) => (aba === "favoritas" ? r.is_favorite : true));
  const sorted = [...filtered].sort((a, b) => {
    if (a.is_new && !b.is_new) return -1;
    if (!a.is_new && b.is_new) return 1;
    return (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0);
  });

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle
        a="Receitas"
        b="da casa"
        action={
          <Button
            aria-label="Nova receita"
            onClick={() =>
              atRecipeLimit
                ? showAlert(
                    `Seu plano permite no máximo ${subscription?.max_saved_recipes} receitas salvas. Faça upgrade pra criar mais.`,
                    "warning",
                  )
                : navigate(ROUTES.receitaNova)
            }
            className="shrink-0 px-3"
          >
            <Plus className="h-5 w-5" /> <span className="hidden md:inline">Nova Receita</span>
          </Button>
        }
      />

      {subscription?.max_saved_recipes != null && (
        <p className="-mt-2 mb-3 text-xs font-semibold text-mut">
          {subscription.saved_recipes_used}/{subscription.max_saved_recipes} receitas salvas
          {atRecipeLimit && (
            <>
              {" "}—{" "}
              <button onClick={() => navigate(ROUTES.assinatura)} className="font-extrabold text-act-text hover:underline">
                fazer upgrade
              </button>
            </>
          )}
        </p>
      )}

      <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)}>
        <TabsList className="mb-2">
          <TabsTab value="todas">Minhas</TabsTab>
          <TabsTab value="favoritas">Favoritas</TabsTab>
          <button
            type="button"
            onClick={() => navigate(ROUTES.comunidade)}
            className="shrink-0 rounded-xl px-3.5 py-2 text-sm font-bold text-mut hover:bg-soft"
          >
            Explorar
          </button>
        </TabsList>
      </Tabs>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {Object.entries(CATEGORIES).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] font-bold ${filter === key ? "bg-ink text-bg" : "bg-card text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {aba === "todas" && recommendations.length > 0 && !loading && (
        <div className="mb-6">
          <h2 className="mb-2 flex items-center gap-2 text-[17px] font-extrabold text-ink">
            <Target className="h-5 w-5 text-act-text" /> Escolhidas para Você
          </h2>
          <div className="flex snap-x gap-3 overflow-x-auto pb-2">
            {semDuplicadas(recommendations).map((recipe) => (
              <button
                key={recipe.id}
                type="button"
                onClick={() => abrir(recipe)}
                className="min-w-[260px] snap-center rounded-3xl border border-line bg-card p-4 text-left active:scale-[.97]"
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <span className="max-w-[140px] truncate rounded-md bg-act-soft px-1.5 py-0.5 text-[9.5px] font-black tracking-wide text-act-text">
                    {rotuloCategoria(recipe.category)}
                  </span>
                  <span className="text-xs font-semibold text-mut">{rotuloKcal(recipe.calories)}</span>
                </div>
                <h3 className="line-clamp-1 text-sm font-extrabold text-ink">{recipe.title}</h3>
                <p className="mt-1 line-clamp-2 h-8 text-xs leading-relaxed text-mut">
                  {formatInstructions(cleanMarkdown(recipe.instructions))}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-3xl" />
          ))}
        </div>
      )}

      {!loading && sorted.length === 0 && (
        <div className="rounded-3xl border-2 border-dashed border-line py-16 text-center">
          <ChefHat className="mx-auto mb-3 h-12 w-12 text-mut" aria-hidden />
          <h3 className="text-lg font-extrabold text-ink">Nada encontrado</h3>
          <p className="mt-1 text-sm text-mut">
            {aba === "favoritas" ? "Você ainda não favoritou receitas." : "Você ainda não tem receitas."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {sorted.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            showNew
            onOpen={() => abrir(recipe)}
            onToggleFavorite={(e) => toggleFavorite(e, recipe)}
          />
        ))}
      </div>
    </div>
  );
}
