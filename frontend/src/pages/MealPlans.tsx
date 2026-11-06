import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  CalendarRange,
  Check,
  ChefHat,
  FolderOpen,
  Plus,
  ShoppingCart,
  Sparkles,
  Trash2,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { format } from "date-fns";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import { useSubscription } from "../lib/SubscriptionContext";
import { extractDiaryErrorMessage, formatKcal, toIsoDate } from "../lib/diary";
import { FOTO_POR_SLOT } from "../lib/refeicaoFoto";
import { useDiaryDay } from "../lib/useDiaryDay";
import { useAtualizarDia } from "../lib/useAtualizar";
import { FaixaDeDias } from "../components/hoje/FaixaDeDias";
import { PullToRefresh } from "../components/PullToRefresh";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { Tabs, TabsList, TabsPanel, TabsTab } from "../components/ui/Tabs";
import { toast } from "../components/ui/toastStore";
import { ROUTES } from "../routes";
import type { DiaryDay, DiaryPlanBindingCreate, MealPlan } from "../types";

const ATALHOS: Array<[LucideIcon, string, string]> = [
  [ShoppingCart, "Compras", ROUTES.compras],
  [Sparkles, "Gerar novo", ROUTES.cardapioGerar],
  [ChefHat, "Chef IA", ROUTES.chef],
  [BookOpen, "Receitas", ROUTES.receitas],
  [Trophy, "Comunidade", ROUTES.comunidade],
];

/**
 * Cardápios: duas abas.
 * - "Esta semana" (`cardapio()` do protótipo): o dia do cardápio vigente, refeição por refeição, com
 *   foto fixa e atalhos. Os dados vêm do próprio diário (`GET /diary`), que já traz o planejado.
 * - "Meus cardápios" (`pgPlans()`): a lista dos planos salvos, com Ativar, abrir e excluir.
 */
export function MealPlans() {
  const navigate = useNavigate();
  const diary = useDiaryDay();
  const atualizar = useAtualizarDia(diary);
  const [aba, setAba] = useState<"semana" | "lista">("semana");

  return (
    <PullToRefresh onRefresh={atualizar}>
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-black leading-[1.05] tracking-[-0.025em]">
              Cardápio <span className="text-act-text">da semana</span>
            </h1>
            <p className="text-[12.5px] font-semibold text-mut">
              {diary.day?.meal_plan ? `“${diary.day.meal_plan.title}”` : "Nenhum cardápio ativo"}
            </p>
          </div>
        </div>

        <nav aria-label="Atalhos" className="flex gap-1.5 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ATALHOS.map(([Icone, nome, to]) => (
            <button
              key={to}
              type="button"
              onClick={() => navigate(to)}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-[12.5px] font-bold active:scale-[.97]"
            >
              <Icone className="h-[15px] w-[15px]" aria-hidden="true" />
              {nome}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAba("lista")}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-[12.5px] font-bold active:scale-[.97]"
          >
            <FolderOpen className="h-[15px] w-[15px]" aria-hidden="true" />
            Meus cardápios
          </button>
        </nav>

        <Tabs value={aba} onValueChange={(v) => setAba(v as "semana" | "lista")}>
          <TabsList aria-label="Cardápios">
            <TabsTab value="semana">Esta semana</TabsTab>
            <TabsTab value="lista">Meus cardápios</TabsTab>
          </TabsList>
          <TabsPanel value="semana" className="pt-2">
            <Semana diary={diary} />
          </TabsPanel>
          <TabsPanel value="lista" className="pt-2">
            <MeusCardapios ativoId={diary.day?.meal_plan?.meal_plan_id ?? null} onAtivado={diary.reload} />
          </TabsPanel>
        </Tabs>
      </div>
    </PullToRefresh>
  );
}

function Semana({ diary }: { diary: ReturnType<typeof useDiaryDay> }) {
  const navigate = useNavigate();
  const dia: DiaryDay | null = diary.day;

  return (
    <div>
      <FaixaDeDias date={diary.date} onSelect={diary.goToDate} />

      {diary.status === "loading" && (
        <div aria-hidden="true" className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[72px] rounded-[22px]" />
          ))}
        </div>
      )}

      {diary.status === "error" && (
        <div className="rounded-3xl bg-card p-5 text-center">
          <p className="text-sm text-mut">{diary.error}</p>
          <Button variant="outline" onClick={diary.reload} className="mt-3 px-3 py-1.5 text-xs">
            Tentar de novo
          </Button>
        </div>
      )}

      {diary.status === "ready" && dia && !dia.meal_plan && dia.planned_totals.calories <= 0 && (
        <div className="rounded-3xl border-2 border-dashed border-line p-6 text-center">
          <p className="text-sm font-extrabold">Nenhum cardápio neste dia.</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-mut">
            Gere um cardápio com o Agente ou ative um dos seus cardápios salvos.
          </p>
          <Button onClick={() => navigate(ROUTES.cardapioGerar)} className="mt-3">
            <Sparkles aria-hidden="true" className="h-4 w-4" />
            Gerar novo cardápio
          </Button>
        </div>
      )}

      {diary.status === "ready" && dia && (dia.meal_plan || dia.planned_totals.calories > 0) && (
        <ol className="space-y-2">
          {dia.slots
            .filter((s) => s.planned_meals.length > 0 || s.planned_calories > 0)
            .map((s) => {
              const feito = s.entries.length > 0 || s.logged_calories > 0;
              const titulo = s.planned_meals.map((m) => m.title).join(", ") || "Refeição planejada";
              return (
                <li key={s.slot} className="flex items-center gap-3 rounded-[22px] bg-card px-3.5 py-3">
                  <div
                    role="img"
                    aria-label={s.label}
                    className="h-14 w-14 flex-none rounded-2xl bg-cover bg-center"
                    style={{ backgroundImage: `url(${FOTO_POR_SLOT[s.slot]})` }}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block text-[12.5px] text-mut">
                      {s.label} · {formatKcal(s.planned_calories)} kcal
                    </span>
                    <b className="block text-[15px]">{titulo}</b>
                  </div>
                  {feito && (
                    <span className="flex items-center gap-1 text-xs font-extrabold text-pos-text">
                      <Check className="h-5 w-5" aria-hidden="true" />
                      <span className="sr-only">Registrado</span>
                    </span>
                  )}
                </li>
              );
            })}
        </ol>
      )}
    </div>
  );
}

function MeusCardapios({ ativoId, onAtivado }: { ativoId: number | null; onAtivado: () => void }) {
  const navigate = useNavigate();
  const { showAlert, confirmDialog } = useAlert();
  const { subscription } = useSubscription();
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [ativando, setAtivando] = useState<number | null>(null);

  const limite = subscription?.max_saved_meal_plans;
  const noLimite = limite !== null && limite !== undefined && plans.length >= limite;

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const res = await api.get("/meal-plans/");
        if (ativo) setPlans(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error(error);
        if (ativo) setPlans([]);
      } finally {
        if (ativo) setLoading(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  async function excluir(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!(await confirmDialog("Excluir este plano alimentar?", { danger: true }))) return;
    try {
      await api.delete(`/meal-plans/${id}`);
      setPlans((prev) => prev.filter((p) => p.id !== id));
      showAlert("Plano excluído.", "success");
    } catch (error) {
      showAlert("Erro ao excluir plano.", "error");
      console.error(error);
    }
  }

  async function ativar(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    setAtivando(id);
    try {
      const body: DiaryPlanBindingCreate = { meal_plan_id: id, start_date: toIsoDate(new Date()) };
      await api.post("/diary/plan-bindings", body);
      toast("Cardápio ativado a partir de hoje");
      onAtivado();
    } catch (err) {
      showAlert(extractDiaryErrorMessage(err, "Não foi possível ativar este cardápio."), "error");
    } finally {
      setAtivando(null);
    }
  }

  if (loading) {
    return (
      <div aria-hidden="true" className="space-y-2">
        <Skeleton className="h-16 rounded-[22px]" />
        <Skeleton className="h-16 rounded-[22px]" />
      </div>
    );
  }

  return (
    <div>
      {limite !== null && limite !== undefined && (
        <p className="mb-2 text-xs text-mut">
          {plans.length}/{limite} planos salvos
          {noLimite && (
            <>
              {" — "}
              <button type="button" onClick={() => navigate(ROUTES.assinatura)} className="font-bold text-act-text">
                fazer upgrade
              </button>
            </>
          )}
        </p>
      )}

      {plans.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-line p-6 text-center">
          <CalendarRange className="mx-auto mb-2 h-9 w-9 text-mut" aria-hidden="true" />
          <p className="text-sm font-extrabold">Você ainda não tem planos alimentares salvos.</p>
          <p className="mt-1 text-sm text-mut">
            Gere um cardápio com o Agente e salve, ou monte um manualmente com suas receitas.
          </p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-[22px] bg-card">
          {plans.map((plan) => (
            <li key={plan.id} className="flex items-center gap-2 border-b border-line px-3.5 py-3 last:border-b-0">
              <button
                type="button"
                onClick={() => navigate(ROUTES.cardapio(plan.id))}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[14px] bg-act-soft text-act-text">
                  <CalendarRange className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[15px]">
                    {plan.title}{" "}
                    {ativoId === plan.id && (
                      <span className="ml-1 rounded-md bg-pos-soft px-1.5 py-px align-[2px] text-[9.5px] font-black tracking-wide text-pos-text">
                        ATIVO
                      </span>
                    )}
                  </b>
                  <span className="block text-xs text-mut">
                    {plan.days.length} dia(s) · {plan.days.reduce((sum, d) => sum + d.meals.length, 0)} refeições ·{" "}
                    {format(new Date(plan.created_at), "dd/MM/yyyy")}
                  </span>
                </span>
              </button>
              {ativoId !== plan.id && (
                <Button
                  variant="outline"
                  disabled={ativando === plan.id}
                  onClick={(e) => ativar(plan.id, e)}
                  className="px-3 py-1.5 text-[12.5px]"
                >
                  Ativar
                </Button>
              )}
              <button
                type="button"
                onClick={(e) => excluir(plan.id, e)}
                aria-label={`Excluir ${plan.title}`}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-mut"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 pt-4">
        <Button onClick={() => navigate(ROUTES.cardapioGerar)} className="flex-1">
          <Sparkles aria-hidden="true" className="h-4 w-4" />
          Gerar novo cardápio
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            noLimite
              ? showAlert(
                  `Seu plano permite no máximo ${limite} planos alimentares salvos. Faça upgrade pra criar mais.`,
                  "warning",
                )
              : navigate(ROUTES.cardapioNovo)
          }
          className="flex-1"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          Criar plano manual
        </Button>
      </div>
    </div>
  );
}
