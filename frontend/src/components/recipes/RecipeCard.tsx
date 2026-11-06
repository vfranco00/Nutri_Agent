import { Bot, ChefHat, Clock, Flame, Star } from "lucide-react";
import type { Recipe } from "../../types";

interface RecipeCardProps {
  recipe: Recipe;
  onOpen: () => void;
  /** Mostra a estrela de favorita (só nas receitas do próprio usuário). */
  onToggleFavorite?: (e: React.MouseEvent) => void;
  showNew?: boolean;
}

/** Cartão de receita da grade: miniatura, título, kcal e tempo. */
export function RecipeCard({ recipe, onOpen, onToggleFavorite, showNew }: RecipeCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="relative cursor-pointer rounded-3xl border border-line bg-card p-2 transition-transform duration-[140ms] ease-out active:scale-[.97] focus-visible:outline-2 focus-visible:outline-act-text"
    >
      <div className="relative flex h-24 items-center justify-center rounded-2xl bg-soft text-mut">
        <ChefHat className="h-8 w-8" aria-hidden />
        {showNew && recipe.is_new && (
          <span className="absolute left-2 top-2 rounded-md bg-pos-soft px-1.5 py-0.5 text-[9.5px] font-black tracking-wide text-pos-text">
            NOVA
          </span>
        )}
        {recipe.is_ai && (
          <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-act-soft px-1.5 py-0.5 text-[9.5px] font-black tracking-wide text-act-text">
            <Bot className="h-3 w-3" aria-hidden /> IA
          </span>
        )}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label={recipe.is_favorite ? "Remover das favoritas" : "Favoritar"}
            className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-card"
          >
            <Star className={`h-4 w-4 ${recipe.is_favorite ? "fill-act text-act" : "text-mut"}`} />
          </button>
        )}
      </div>
      <b className="mx-0.5 mt-1.5 line-clamp-2 block text-[13px] font-extrabold leading-tight text-ink">
        {recipe.title}
      </b>
      <span className="mx-0.5 mt-0.5 flex items-center gap-3 text-[11.5px] font-semibold text-mut">
        <span className="flex items-center gap-1">
          <Flame className="h-3 w-3" aria-hidden /> {Math.round(recipe.calories || 0)} kcal
        </span>
        {recipe.prep_time ? (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden /> {recipe.prep_time} min
          </span>
        ) : null}
      </span>
    </div>
  );
}
