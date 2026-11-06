import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bot, ChefHat, Clock, Edit2, Flame, Plus, Save, Square, Trash2, User as UserIcon, Volume2 } from "lucide-react";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import { cleanMarkdown, formatInstructions } from "../lib/utils";
import type { Recipe } from "../types";
import { BouncingDots } from "../components/BouncingDots";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { Tabs, TabsList, TabsPanel, TabsTab } from "../components/ui/Tabs";
import { ROUTES } from "../routes";

interface EditFormData {
  title: string;
  instructions: string;
  prep_time: number;
  calories: number;
  preparation_method: string;
  category: string;
  ingredients: { name: string; quantity: number | string; unit: string; calories?: number }[];
}

const CAMPO =
  "rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-mut focus-visible:outline-2 focus-visible:outline-act-text";

function toForm(recipe: Recipe): EditFormData {
  return {
    title: recipe.title,
    instructions: recipe.instructions,
    prep_time: recipe.prep_time || 0,
    calories: recipe.calories || 0,
    preparation_method: recipe.preparation_method || "fogao",
    category: recipe.category || "almoco",
    ingredients: (recipe.ingredients ?? []).map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      calories: i.calories,
    })),
  };
}

export function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showAlert, confirmDialog } = useAlert();
  const state = (location.state ?? {}) as { recipe?: Recipe; mine?: boolean };

  const [recipe, setRecipe] = useState<Recipe | null>(state.recipe ?? null);
  const [mine, setMine] = useState<boolean>(state.mine ?? false);
  const [loading, setLoading] = useState(!state.recipe);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<EditFormData | null>(state.recipe ? toForm(state.recipe) : null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Sem `state` (link direto ou recarregar a página): procura nas minhas e nas públicas.
  useEffect(() => {
    if (recipe) return;
    let vivo = true;
    (async () => {
      try {
        const rid = Number(id);
        const minhas = await api.get("/recipes/");
        const achouMinha = Array.isArray(minhas?.data) ? minhas.data.find((r: Recipe) => r.id === rid) : null;
        if (achouMinha) {
          if (vivo) {
            setRecipe(achouMinha);
            setMine(true);
            setForm(toForm(achouMinha));
          }
          return;
        }
        const publicas = await api.get("/recipes/public");
        const achouPublica = Array.isArray(publicas?.data) ? publicas.data.find((r: Recipe) => r.id === rid) : null;
        if (vivo && achouPublica) {
          setRecipe(achouPublica);
          setMine(false);
          setForm(toForm(achouPublica));
        }
      } catch (error) {
        console.error("Erro ao carregar receita:", error);
      } finally {
        if (vivo) setLoading(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [id, recipe]);

  // Receita nova vista: marca como lida (como o modal antigo fazia).
  useEffect(() => {
    if (recipe && mine && recipe.is_new) {
      api.put(`/recipes/${recipe.id}`, { ...recipe, is_new: false }).catch((e) => console.error(e));
    }
  }, [recipe, mine]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  function voltar() {
    navigate(mine ? ROUTES.receitas : ROUTES.comunidade);
  }

  function handleSpeak() {
    if (!recipe) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const texto = `Receita: ${recipe.title}. Modo de preparo: ${formatInstructions(cleanMarkdown(recipe.instructions))}`;
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = "pt-BR";
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }

  async function handleSave() {
    if (!recipe || !form) return;
    setSaving(true);
    try {
      const res = await api.put(`/recipes/${recipe.id}`, form);
      setRecipe(res.data);
      setForm(toForm(res.data));
      setIsEditing(false);
      showAlert("Receita atualizada!", "success");
    } catch (error) {
      console.error(error);
      showAlert("Erro ao atualizar.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!recipe) return;
    if (await confirmDialog("Tem certeza que deseja excluir esta receita?", { danger: true })) {
      setDeleting(true);
      try {
        await api.delete(`/recipes/${recipe.id}`);
        navigate(ROUTES.receitas, { replace: true });
      } catch (error) {
        showAlert("Erro ao excluir.", "error");
        console.error(error);
        setDeleting(false);
      }
    }
  }

  function updateIngredient(index: number, field: string, value: string | number) {
    if (!form) return;
    const ingredients = form.ingredients.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing));
    setForm({ ...form, ingredients });
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-40 w-full rounded-3xl" />
      </div>
    );
  }

  if (!recipe || !form) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border-2 border-dashed border-line py-16 text-center">
        <ChefHat className="mx-auto mb-3 h-12 w-12 text-mut" aria-hidden />
        <h2 className="text-lg font-extrabold text-ink">Receita não encontrada</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate(ROUTES.receitas)}>
          Voltar para Receitas
        </Button>
      </div>
    );
  }

  const ingredientes = recipe.ingredients ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          onClick={voltar}
          aria-label="Voltar"
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-2xl text-ink hover:bg-soft"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {!isEditing && (
          <button
            onClick={handleSpeak}
            aria-label={isSpeaking ? "Parar leitura" : "Ouvir o modo de preparo"}
            className={`flex h-10 w-10 items-center justify-center rounded-2xl ${isSpeaking ? "bg-act text-nuvi-tinta" : "bg-card text-ink"}`}
          >
            {isSpeaking ? <Square className="h-4 w-4 fill-current" /> : <Volume2 className="h-5 w-5" />}
          </button>
        )}
      </div>

      <div className="mb-3 flex h-40 items-center justify-center rounded-3xl bg-soft text-mut">
        <ChefHat className="h-12 w-12" aria-hidden />
      </div>

      {isEditing ? (
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          aria-label="Título"
          className={`${CAMPO} w-full text-xl font-black`}
        />
      ) : (
        <h2 className="text-2xl font-black leading-tight tracking-tight text-ink">{recipe.title}</h2>
      )}

      <p className="mt-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-mut">
        {recipe.is_ai ? (
          <>
            <Bot className="h-3.5 w-3.5" aria-hidden /> Gerado por IA
          </>
        ) : mine ? (
          <>
            <UserIcon className="h-3.5 w-3.5" aria-hidden /> Criado por você
          </>
        ) : (
          <>
            <UserIcon className="h-3.5 w-3.5" aria-hidden /> Receita da comunidade
          </>
        )}
      </p>

      <div className="mt-3 flex gap-2">
        <div className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-soft px-2 py-2.5 text-[11.5px] text-mut">
          <Clock className="h-4 w-4" aria-hidden />
          {isEditing ? (
            <input
              type="number"
              aria-label="Tempo de preparo (min)"
              className="w-14 border-b border-line bg-transparent text-center text-sm font-extrabold text-ink outline-none"
              value={form.prep_time}
              onChange={(e) => setForm({ ...form, prep_time: Number(e.target.value) })}
            />
          ) : (
            <b className="text-sm text-ink">{recipe.prep_time || 0} min</b>
          )}
        </div>
        <div className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-soft px-2 py-2.5 text-[11.5px] text-mut">
          <Flame className="h-4 w-4" aria-hidden />
          {isEditing ? (
            <input
              type="number"
              aria-label="Calorias (kcal)"
              className="w-14 border-b border-line bg-transparent text-center text-sm font-extrabold text-ink outline-none"
              value={form.calories}
              onChange={(e) => setForm({ ...form, calories: Number(e.target.value) })}
            />
          ) : (
            <b className="text-sm text-ink">{Math.round(recipe.calories || 0)} kcal</b>
          )}
        </div>
      </div>

      <Tabs defaultValue="ing" className="mt-4">
        <TabsList>
          <TabsTab value="ing">Ingredientes</TabsTab>
          <TabsTab value="mod">Modo de Preparo</TabsTab>
        </TabsList>

        <TabsPanel value="ing" className="mt-2">
          {isEditing && (
            <div className="mb-2 flex justify-end">
              <button
                onClick={() =>
                  setForm({ ...form, ingredients: [...form.ingredients, { name: "", quantity: 1, unit: "un", calories: 0 }] })
                }
                className="flex items-center gap-1 text-xs font-extrabold text-act-text"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </button>
            </div>
          )}
          <ul className="overflow-hidden rounded-3xl border border-line bg-card">
            {isEditing
              ? form.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-center gap-2 border-b border-line p-2.5 last:border-b-0">
                    <input
                      value={ing.name}
                      onChange={(e) => updateIngredient(i, "name", e.target.value)}
                      className={`${CAMPO} min-w-0 flex-1`}
                      placeholder="Nome"
                    />
                    <input
                      type="number"
                      value={ing.quantity}
                      onChange={(e) => updateIngredient(i, "quantity", e.target.value)}
                      className={`${CAMPO} w-16`}
                      placeholder="Qtd"
                    />
                    <input
                      value={ing.unit}
                      onChange={(e) => updateIngredient(i, "unit", e.target.value)}
                      className={`${CAMPO} w-16`}
                      placeholder="Un"
                    />
                    <button
                      onClick={() => setForm({ ...form, ingredients: form.ingredients.filter((_, j) => j !== i) })}
                      aria-label="Remover ingrediente"
                      className="text-mut hover:text-ink"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))
              : ingredientes.map((ing) => (
                  <li key={ing.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
                    <div className="min-w-0">
                      <b className="block text-sm font-extrabold text-ink">{ing.name}</b>
                      <span className="text-xs text-mut">
                        {ing.quantity} {ing.unit}
                      </span>
                    </div>
                    {ing.calories ? (
                      <span className="shrink-0 text-[12.5px] font-bold text-mut">~{Math.round(ing.calories)} kcal</span>
                    ) : null}
                  </li>
                ))}
          </ul>
        </TabsPanel>

        <TabsPanel value="mod" className="mt-2">
          {isEditing ? (
            <textarea
              rows={8}
              aria-label="Modo de preparo"
              className={`${CAMPO} w-full resize-none`}
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            />
          ) : (
            <p className="whitespace-pre-wrap rounded-3xl border border-line bg-card p-4 text-sm leading-relaxed text-ink">
              {formatInstructions(cleanMarkdown(recipe.instructions))}
            </p>
          )}
        </TabsPanel>
      </Tabs>

      {mine && (
        <div className="mt-5 flex items-center justify-between gap-3">
          {isEditing ? (
            <>
              <Button variant="ghost" onClick={() => { setIsEditing(false); setForm(toForm(recipe)); }}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <BouncingDots /> : <><Save className="h-4 w-4" /> Salvar</>}
              </Button>
            </>
          ) : (
            <>
              {!recipe.is_ai ? (
                <Button variant="outline" onClick={handleDelete} disabled={deleting}>
                  {deleting ? <BouncingDots /> : <><Trash2 className="h-4 w-4" /> Excluir</>}
                </Button>
              ) : (
                <span className="flex items-center gap-1 text-xs font-semibold text-mut" title="Gerado por IA (Protegido)">
                  <Bot className="h-4 w-4" /> Gerada por IA
                </span>
              )}
              <Button onClick={() => setIsEditing(true)}>
                <Edit2 className="h-4 w-4" /> Editar
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
