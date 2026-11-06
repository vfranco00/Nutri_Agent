import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Trophy, ChefHat } from "lucide-react";
import { api } from "../lib/api";
import { type Recipe, type LeaderboardEntry, CATEGORIES } from "../types";
import { PageTitle } from "../components/PageTitle";
import { RecipeCard } from "../components/recipes/RecipeCard";
import { Skeleton } from "../components/ui/Skeleton";
import { ROUTES } from "../routes";

export function Comunidade() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/recipes/public");
        setRecipes(res && Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error("Erro ao carregar receitas públicas:", error);
        setRecipes([]);
      } finally {
        setLoading(false);
      }
    })();
    (async () => {
      try {
        const res = await api.get("/users/leaderboard");
        setLeaderboard(res && Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error("Erro ao buscar leaderboard:", error);
        setLeaderboard([]);
      }
    })();
  }, []);

  const shown = filter === "all" ? recipes : recipes.filter((r) => r.category === filter);

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle a="Comuni" b="dade" />

      {leaderboard.length > 0 && (
        <section className="mb-4 rounded-3xl bg-bar p-4 text-bar-on">
          <h3 className="mb-2 flex items-center gap-2 text-[12.5px] font-bold text-bar-ink">
            <Trophy className="h-4 w-4" aria-hidden /> Top chefs da semana
          </h3>
          <div className="space-y-1">
            {leaderboard.map((user, idx) => (
              <div key={user.id} className="flex items-center gap-3 rounded-xl px-1.5 py-2">
                <b className={`w-5 text-center ${idx === 0 ? "text-nuvi-gomo" : ""}`}>{idx + 1}</b>
                <span className="flex-1 truncate font-bold">{user.display_name}</span>
                {idx === 0 && <Crown className="h-4 w-4 text-nuvi-gomo" aria-hidden />}
                <b>{user.score} XP</b>
              </div>
            ))}
          </div>
        </section>
      )}

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

      {loading && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-3xl" />
          ))}
        </div>
      )}

      {!loading && shown.length === 0 && (
        <div className="rounded-3xl border-2 border-dashed border-line py-16 text-center">
          <ChefHat className="mx-auto mb-3 h-12 w-12 text-mut" aria-hidden />
          <h3 className="text-lg font-extrabold text-ink">Nada encontrado</h3>
          <p className="mt-1 text-sm text-mut">Ainda não há receitas públicas.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {shown.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onOpen={() => navigate(ROUTES.receita(recipe.id), { state: { recipe, mine: false } })}
          />
        ))}
      </div>
    </div>
  );
}
