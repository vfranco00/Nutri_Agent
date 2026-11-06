import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import { useSubscription } from "../lib/SubscriptionContext";
import { NuviLoader } from "../components/brand/NuviLoader";
import { PageTitle } from "../components/PageTitle";
import { EmBreve } from "../components/EmBreve";
import { IA_DISPONIVEL } from "../lib/ia";
import { Button } from "../components/ui/Button";
import { ROUTES } from "../routes";
import { getRandomTip } from "../lib/tips";
import { formatInstructions } from "../lib/utils";
import { ChefHat, Plus, Save, Clock, Flame, Users, Carrot, X } from "lucide-react";

export function AiChef() {
  return IA_DISPONIVEL ? <AiChefAtivo /> : <AiChefEmBreve />;
}

function AiChefEmBreve() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle a="O que tem" b="na geladeira?" />
      <EmBreve
        texto="O Chef IA está em manutenção e volta logo. Enquanto isso, escreva a sua receita à mão."
        acao={{ label: "Criar receita", onClick: () => navigate(ROUTES.receitaNova) }}
      />
    </div>
  );
}

function AiChefAtivo() {
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  const { getUsage, refreshSubscription } = useSubscription();
  const chefAiUsage = getUsage("chef_ai");
  const [chips, setChips] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [tip] = useState(() => getRandomTip());
  const [servings, setServings] = useState(1);
  const [loading, setLoading] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  function addChip() {
    const v = draft.trim();
    if (!v) return;
    if (!chips.some((c) => c.toLowerCase() === v.toLowerCase())) setChips([...chips, v]);
    setDraft("");
  }

  async function handleGenerate() {
    if (chips.length === 0) return;
    setLoading(true);
    setGeneratedRecipe(null); // Limpa o estado anterior por segurança

    try {
      const list = chips;

      const res = await api.post("/ai/recipe-by-ingredients", {
        ingredients: list,
        servings,
      });

      // Checagem de segurança: A IA realmente respondeu?
      if (res && res.data) {
        setGeneratedRecipe(res.data);
      } else {
        // Força cair no catch se a resposta vier vazia
        throw new Error("Resposta inválida ou vazia da IA");
      }
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      if (detail?.code === "PLAN_LIMIT_REACHED") {
        showAlert(detail.message, "warning");
      } else {
        showAlert(
          "Erro ao gerar receita. O Chef IA pode estar sobrecarregado, tente novamente.",
          "error",
        );
      }
      console.error("Erro no Chef IA:", error);
      setGeneratedRecipe(null); // Fallback absoluto
    } finally {
      setLoading(false);
      refreshSubscription();
    }
  }

  async function handleSaveRecipe() {
    if (!generatedRecipe || saving) return;
    setSaving(true);

    try {
      // is_public explícito: o backend não força mais a publicação. Aqui a receita
      // sai da geração pelo Chef IA e continua indo pro feed da comunidade, como
      // sempre foi — mas agora porque este código pede, e não porque o servidor
      // sobrescrevia a escolha de todo mundo.
      const res = await api.post("/recipes/", { ...generatedRecipe, is_ai: true, is_public: true });

      // Só redireciona o usuário se o backend confirmar que salvou
      if (res && res.data) {
        showAlert("Receita salva com sucesso!", "success");
        navigate(ROUTES.receitas);
      } else {
        throw new Error("Backend não retornou confirmação de salvamento");
      }
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      if (detail?.code === "PLAN_LIMIT_REACHED") {
        showAlert(detail.message, "warning");
      } else {
        showAlert("Erro ao salvar. Verifique se o servidor está online.", "error");
      }
      console.error("Erro ao salvar receita:", error);
    } finally {
      setSaving(false);
    }
  }

  const limitReached = chefAiUsage ? chefAiUsage.used >= (chefAiUsage.limit ?? Infinity) : false;

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle a="O que tem" b="na geladeira?" />

      <div className="mb-4 rounded-3xl border border-line bg-card p-5">
        <label htmlFor="chef-ing" className="mb-2 block text-xs font-bold text-mut">
          Quais ingredientes você tem?
        </label>
        {chips.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {chips.map((c, i) => (
              <button
                key={c}
                type="button"
                onClick={() => setChips(chips.filter((_, j) => j !== i))}
                aria-label={`Remover ${c}`}
                className="flex items-center gap-1 rounded-full bg-ink px-3 py-2 text-[12.5px] font-bold text-bg"
              >
                {c} <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            id="chef-ing"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addChip();
              }
            }}
            placeholder="adicionar ingrediente (ex.: ovo)"
            className="min-w-0 flex-1 rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink placeholder:text-mut focus-visible:outline-2 focus-visible:outline-act-text"
          />
          <Button variant="outline" onClick={addChip} aria-label="Adicionar ingrediente" className="px-3">
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        <div className="mt-4">
          <span className="mb-2 block text-xs font-bold text-mut">Rendimento (quantas pessoas?)</span>
          <div className="grid grid-cols-4 gap-2 rounded-2xl bg-soft p-1">
            {[1, 2, 4, 6].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setServings(count)}
                aria-pressed={servings === count}
                className={`rounded-xl py-2 text-sm font-bold ${servings === count ? "bg-card text-ink" : "text-mut"}`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={handleGenerate} disabled={loading || chips.length === 0 || limitReached} className="mt-4 w-full">
          <ChefHat className="h-5 w-5" /> Criar Receita Criativa
        </Button>
        {chefAiUsage && chefAiUsage.limit !== null && (
          <p className="mt-2 text-center text-xs font-semibold text-mut">
            {chefAiUsage.used}/{chefAiUsage.limit} usados nos últimos {chefAiUsage.window_days} dias
            {chefAiUsage.used >= chefAiUsage.limit && (
              <>
                {" "}—{" "}
                <button onClick={() => navigate(ROUTES.assinatura)} className="font-extrabold text-act-text hover:underline">
                  fazer upgrade
                </button>
              </>
            )}
          </p>
        )}
      </div>

      {loading && (
        <div className="mb-4 flex flex-col items-center gap-3 rounded-3xl border border-line bg-card p-6 text-center">
          <NuviLoader active={loading} size={56} label="O Chef está criando sua receita" />
          <p className="text-sm font-bold text-ink">O Chef está criando sua receita…</p>
          <p className="max-w-md text-xs italic text-mut">Dica do Nuvi: "{tip}"</p>
        </div>
      )}

      {generatedRecipe && (
        <div className="space-y-5 rounded-3xl border border-line bg-card p-5">
          <h2 className="text-xl font-black tracking-tight text-ink">{generatedRecipe.title}</h2>

          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2 rounded-2xl bg-soft px-3 py-2 text-sm font-bold text-ink">
              <Clock className="h-4 w-4 text-mut" aria-hidden />
              <span>{generatedRecipe.prep_time} min</span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-soft px-3 py-2 text-sm font-bold text-ink">
              <Flame className="h-4 w-4 text-mut" aria-hidden />
              <span>~ {Math.round(generatedRecipe.calories || 0)} kcal</span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-soft px-3 py-2 text-sm font-bold text-ink">
              <Users className="h-4 w-4 text-mut" aria-hidden />
              <span>Serve {servings} pessoa{servings > 1 ? "s" : ""}</span>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-[17px] font-extrabold text-ink">
              <Carrot className="h-4 w-4 text-act-text" aria-hidden /> Ingredientes
            </h3>
            <ul className="overflow-hidden rounded-2xl border border-line">
              {generatedRecipe.ingredients.map((ing: any, i: number) => (
                <li key={i} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
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
          </div>

          <div className="space-y-2">
            <h3 className="text-[17px] font-extrabold text-ink">Modo de Preparo</h3>
            <p className="whitespace-pre-wrap rounded-2xl bg-soft p-4 text-sm leading-relaxed text-ink">
              {formatInstructions(generatedRecipe.instructions)}
            </p>
          </div>

          <Button onClick={handleSaveRecipe} disabled={saving} className="w-full">
            <Save className="h-5 w-5" /> {saving ? "Salvando…" : "Salvar na Minha Lista"}
          </Button>
        </div>
      )}
    </div>
  );
}
