import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  Trophy,
  UtensilsCrossed,
} from "lucide-react";
import { api } from "../lib/api";
import {
  buildNextSteps,
  formatDayShort,
  formatKcal,
  relativeDayLabel,
  remainingCalories,
  toIsoDate,
} from "../lib/diary";
import { buildSparkline } from "../lib/sparkline";
import { useDiaryDay } from "../lib/useDiaryDay";
import { EnergyBar } from "../components/diary/EnergyBar";
import { MacroDonut } from "../components/diary/MacroDonut";
import { MealTimeline } from "../components/diary/MealTimeline";
import type { DiaryDay, MealSlot, Profile, User } from "../types";

interface WeightData {
  date: string;
  weight: number;
}

function getLevel(score = 0) {
  if (score < 50) return { title: "Iniciante", next: 50 };
  if (score < 200) return { title: "Cozinheiro", next: 200 };
  if (score < 500) return { title: "Chef", next: 500 };
  return { title: "MasterChef", next: 1000 };
}

/**
 * Dashboard "Hoje" — a tela responde "o que eu como hoje, e quanto ainda cabe?".
 *
 * Todo o dado do diário vem de UMA chamada (`GET /diary?date=`, decisão D-4 do
 * ADR-0001), que já traz entradas, totais, meta e planejado. Nada aqui soma nem
 * arredonda valor nutricional: os números saem literais de `totals` e de
 * `slots[].logged_calories` (§ 9.3).
 *
 * Projeto é Vite + React Router: não há fronteira Server/Client — a árvore
 * inteira é cliente, e o estado do dia é `useState` + `useEffect`, como no
 * resto do app (o projeto não usa React Query).
 */
export function Dashboard() {
  const navigate = useNavigate();
  const diary = useDiaryDay();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [history, setHistory] = useState<WeightData[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const userRes = await api.get("/users/me");
        if (userRes?.data) setUser(userRes.data);
      } catch (e) {
        console.error("Erro ao buscar usuário:", e);
      }
      try {
        const profRes = await api.get("/profiles/me");
        if (profRes?.data) setProfile(profRes.data);
      } catch {
        // Perfil ainda não preenchido — a tela segue, e o "Próximo passo"
        // convida a completá-lo.
      }
      try {
        const historyRes = await api.get("/profiles/weight/history");
        setHistory(Array.isArray(historyRes?.data) ? historyRes.data : []);
      } catch (e) {
        setHistory([]);
        console.error("Erro ao buscar histórico de peso:", e);
      }
    }
    load();
  }, []);

  const hoje = toIsoDate(new Date());
  const level = getLevel(user?.score);

  function irParaRegistro(slot?: MealSlot) {
    const params = new URLSearchParams({ date: diary.date });
    if (slot) params.set("slot", slot);
    navigate(`/diario?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO ------------------------------------------------------- */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-white">
            {relativeDayLabel(diary.date, hoje)}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Olá, {user?.full_name || "Visitante"} — este é o seu dia.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <DayNav diary={diary} hoje={hoje} />
          <span className="hidden items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-semibold text-green-700 sm:inline-flex dark:text-green-400">
            <Trophy aria-hidden="true" className="h-3.5 w-3.5" />
            {level.title} · {user?.score || 0} XP
          </span>
        </div>
      </div>

      {/* Estado assíncrono anunciado — sem isto o leitor de tela não sabe que
          o dia trocou, carregou ou falhou. */}
      <p role="status" aria-live="polite" className="sr-only">
        {diary.status === "loading"
          ? "Carregando o seu dia."
          : diary.status === "error"
            ? `Erro ao carregar o dia: ${diary.error}`
            : diary.day
              ? `Dia ${diary.date} carregado. ${formatKcal(diary.day.totals.calories)} quilocalorias registradas.`
              : ""}
      </p>

      {diary.status === "loading" && <DashboardSkeleton />}

      {diary.status === "error" && (
        <ErrorCard message={diary.error ?? "Erro desconhecido."} onRetry={diary.reload} />
      )}

      {diary.status === "ready" && diary.day && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
          {/* COLUNA PRINCIPAL --------------------------------------------- */}
          <div className="flex min-w-0 flex-col gap-4">
            {diary.isEmpty ? (
              <EmptyDayCard onRegister={() => irParaRegistro()} onPlan={() => navigate("/ai-plan")} />
            ) : (
              <EnergyCard day={diary.day} profile={profile} />
            )}

            <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                  <Clock aria-hidden="true" className="h-4 w-4 text-green-600 dark:text-green-500" />
                  Refeições do dia
                </h2>
                <button
                  type="button"
                  onClick={() => irParaRegistro()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-green-950 hover:bg-green-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 motion-safe:transition-colors dark:focus-visible:ring-offset-zinc-900"
                >
                  <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                  Registrar alimento
                </button>
              </div>

              {diary.day.meal_plan && (
                <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                  Cardápio vigente: <strong className="font-semibold">{diary.day.meal_plan.title}</strong> ·{" "}
                  {diary.day.meal_plan.day_label}
                </p>
              )}

              <MealTimeline day={diary.day} onAddToSlot={(slot) => irParaRegistro(slot)} />

              {diary.day.entries_count >= 55 && (
                <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
                  {diary.day.entries_count} de 60 registros usados neste dia.
                </p>
              )}
            </section>
          </div>

          {/* COLUNA LATERAL ----------------------------------------------- */}
          <div className="flex min-w-0 flex-col gap-4">
            <RemainingCard day={diary.day} onFixTarget={() => navigate("/profile")} />
            <MacroDonut day={diary.day} />
            <NextStepsCard
              day={diary.day}
              hasCalorieTarget={Boolean(profile?.daily_calories)}
              hasWeightHistory={history.length > 0}
              onGo={(path) => navigate(path)}
            />
            <WeightCard history={history} onRegister={() => navigate("/profile")} />
          </div>
        </div>
      )}

      {user?.is_superuser && (
        <button
          onClick={() => navigate("/admin")}
          className="flex w-full items-center gap-4 rounded-xl border border-red-200 bg-white p-5 text-left shadow-sm hover:border-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 motion-safe:transition-all dark:border-red-900/50 dark:bg-zinc-900 dark:focus-visible:ring-offset-zinc-900"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-100 dark:bg-red-500/10">
            <Shield aria-hidden="true" className="h-5 w-5 text-red-600 dark:text-red-500" />
          </div>
          <div>
            <h3 className="font-semibold text-red-600 dark:text-red-500">Painel Admin</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Usuários, finanças, usabilidade e chamados.
            </p>
          </div>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Peças da tela
// ---------------------------------------------------------------------------

function DayNav({
  diary,
  hoje,
}: {
  diary: ReturnType<typeof useDiaryDay>;
  hoje: string;
}) {
  const botao =
    "rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-600 hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 motion-safe:transition-colors disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:focus-visible:ring-offset-zinc-950";

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Dia anterior"
        onClick={() => diary.shiftDay(-1)}
        disabled={diary.mutating}
        className={botao}
      >
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
      </button>
      {/* Mostra a DATA em foco, não um rótulo fixo — ver o comentário de `formatDayShort`. */}
      <button
        type="button"
        onClick={() => diary.goToDate(hoje)}
        disabled={diary.date === hoje || diary.mutating}
        title={diary.date === hoje ? undefined : "Voltar para hoje"}
        aria-label={
          diary.date === hoje
            ? `Hoje, ${formatDayShort(diary.date, hoje)}`
            : `${formatDayShort(diary.date, hoje)}. Voltar para hoje`
        }
        className="min-w-[4.5rem] rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold tabular-nums text-zinc-600 hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 motion-safe:transition-colors disabled:opacity-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:focus-visible:ring-offset-zinc-950"
      >
        {formatDayShort(diary.date, hoje)}
      </button>
      <button
        type="button"
        aria-label="Próximo dia"
        onClick={() => diary.shiftDay(1)}
        disabled={diary.mutating}
        className={botao}
      >
        <ChevronRight aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}

function EnergyCard({ day, profile }: { day: DiaryDay; profile: Profile | null }) {
  return (
    <section
      aria-labelledby="energia-do-dia"
      className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p
            id="energia-do-dia"
            className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
          >
            Energia do dia
          </p>
          <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-zinc-900 dark:text-white">
            {/* O número fica no próprio elemento: é a unidade semântica que o leitor de
                tela anuncia e que o teste endereça — solto, colava na legenda ao lado. */}
            <span>{formatKcal(day.totals.calories)}</span>{" "}
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {day.calories_target !== null
                ? `de ${formatKcal(day.calories_target)} kcal registradas`
                : "kcal registradas"}
            </span>
          </p>
        </div>
        {profile?.goal && (
          <span className="rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] font-semibold text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            meta do perfil · {GOAL_LABELS[profile.goal] ?? profile.goal}
          </span>
        )}
      </div>

      <EnergyBar day={day} />
    </section>
  );
}

const GOAL_LABELS: Record<string, string> = {
  lose_weight: "perder peso",
  maintain: "manter",
  gain_muscle: "ganhar massa",
};

function RemainingCard({ day, onFixTarget }: { day: DiaryDay; onFixTarget: () => void }) {
  const restante = remainingCalories(day);

  if (restante === null) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-5 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Ainda cabem
        </p>
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Defina a sua meta de calorias no perfil para acompanhar quanto ainda cabe no dia.
        </p>
        <button
          type="button"
          onClick={onFixTarget}
          className="mt-3 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 motion-safe:transition-colors dark:border-zinc-700 dark:text-zinc-300 dark:focus-visible:ring-offset-zinc-900"
        >
          Definir meta
        </button>
      </section>
    );
  }

  const acimaDaMeta = restante < 0;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        {acimaDaMeta ? "Acima da meta" : "Ainda cabem"}
      </p>
      <p
        className={`mt-2 text-4xl font-extrabold tracking-tight tabular-nums ${
          acimaDaMeta ? "text-amber-600 dark:text-amber-400" : "text-green-700 dark:text-green-400"
        }`}
      >
        {formatKcal(Math.abs(restante))}
      </p>
      <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        {acimaDaMeta ? "kcal além da meta de hoje" : "kcal até a meta de hoje"}
      </p>
    </section>
  );
}

function NextStepsCard({
  day,
  hasCalorieTarget,
  hasWeightHistory,
  onGo,
}: {
  day: DiaryDay;
  hasCalorieTarget: boolean;
  hasWeightHistory: boolean;
  onGo: (path: string) => void;
}) {
  const passos = buildNextSteps({ day, hasCalorieTarget, hasWeightHistory });
  if (passos.length === 0) return null;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        Próximo passo
      </p>
      <div className="space-y-2">
        {passos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onGo(p.path)}
            className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2.5 text-left hover:border-green-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 motion-safe:transition-colors dark:border-zinc-800 dark:focus-visible:ring-offset-zinc-900"
          >
            <Sparkles aria-hidden="true" className="h-4 w-4 shrink-0 text-green-600 dark:text-green-500" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-zinc-900 dark:text-white">
                {p.title}
              </span>
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">{p.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function WeightCard({ history, onRegister }: { history: WeightData[]; onRegister: () => void }) {
  const spark = buildSparkline(history.map((h) => h.weight));

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Peso
        </p>
        {spark && (
          <span
            className={`text-xs font-bold tabular-nums ${
              spark.delta <= 0 ? "text-green-700 dark:text-green-400" : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {spark.delta > 0 ? "+" : "−"}
            {Math.abs(spark.delta).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg
          </span>
        )}
      </div>

      {spark ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-2xl font-bold tracking-tight tabular-nums text-zinc-900 dark:text-white">
            {spark.last.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}{" "}
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">kg</span>
          </p>
          <svg
            viewBox="0 0 120 36"
            role="img"
            aria-label={`Tendência do peso: de ${spark.first.toLocaleString("pt-BR")} para ${spark.last.toLocaleString("pt-BR")} quilos.`}
            className="h-9 w-[120px] overflow-visible"
          >
            <path
              d={spark.path}
              fill="none"
              className="stroke-green-500"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx={spark.lastX} cy={spark.lastY} r="3" className="fill-green-500" />
          </svg>
        </div>
      ) : (
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {history.length === 1
              ? "Uma pesagem registrada. A tendência aparece a partir da segunda."
              : "Nenhuma pesagem ainda."}
          </p>
          <button
            type="button"
            onClick={onRegister}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 motion-safe:transition-colors dark:border-zinc-700 dark:text-zinc-300 dark:focus-visible:ring-offset-zinc-900"
          >
            <Scale aria-hidden="true" className="h-3.5 w-3.5" />
            Registrar peso
          </button>
        </div>
      )}
    </section>
  );
}

/** Vazio de usuário novo: nada registrado e nenhum cardápio no calendário. */
function EmptyDayCard({ onRegister, onPlan }: { onRegister: () => void; onPlan: () => void }) {
  return (
    <section className="rounded-xl border border-dashed border-green-500/40 bg-green-500/5 p-6 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-green-500/15">
        <UtensilsCrossed aria-hidden="true" className="h-5 w-5 text-green-700 dark:text-green-400" />
      </div>
      <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
        Seu dia está em branco — vamos preencher?
      </h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        Registre o que você comeu e a barra de energia começa a se desenhar aqui. Se preferir, gere
        um cardápio e o dia já nasce planejado.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onRegister}
          className="inline-flex items-center gap-1.5 rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-green-950 hover:bg-green-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 motion-safe:transition-colors dark:focus-visible:ring-offset-zinc-950"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          Registrar primeira refeição
        </button>
        <button
          type="button"
          onClick={onPlan}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 motion-safe:transition-colors dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus-visible:ring-offset-zinc-950"
        >
          <Sparkles aria-hidden="true" className="h-4 w-4" />
          Gerar um cardápio
        </button>
      </div>
    </section>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm dark:border-red-900/50 dark:bg-zinc-900">
      <h2 className="text-base font-bold text-zinc-900 dark:text-white">
        Não conseguimos carregar o seu dia
      </h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 motion-safe:transition-colors dark:border-zinc-700 dark:text-zinc-200 dark:focus-visible:ring-offset-zinc-900"
      >
        <RefreshCw aria-hidden="true" className="h-4 w-4" />
        Tentar de novo
      </button>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-4 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <div className="h-40 rounded-xl border border-zinc-200 bg-zinc-100 motion-safe:animate-pulse dark:border-zinc-800 dark:bg-zinc-900" />
        <div className="h-72 rounded-xl border border-zinc-200 bg-zinc-100 motion-safe:animate-pulse dark:border-zinc-800 dark:bg-zinc-900" />
      </div>
      <div className="flex flex-col gap-4">
        <div className="h-32 rounded-xl border border-zinc-200 bg-zinc-100 motion-safe:animate-pulse dark:border-zinc-800 dark:bg-zinc-900" />
        <div className="h-52 rounded-xl border border-zinc-200 bg-zinc-100 motion-safe:animate-pulse dark:border-zinc-800 dark:bg-zinc-900" />
      </div>
    </div>
  );
}
