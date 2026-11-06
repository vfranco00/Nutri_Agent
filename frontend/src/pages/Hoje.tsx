import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronRight,
  Coffee,
  Cookie,
  Crown,
  Moon,
  Package,
  Plus,
  RefreshCw,
  Salad,
  Sandwich,
  Shield,
  Soup,
  Sparkles,
  Sun,
  TrendingDown,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { buildNextSteps, formatDiaryDate, formatKcal, relativeDayLabel, toIsoDate } from "../lib/diary";
import { useDiaryDay } from "../lib/useDiaryDay";
import { useAtualizarDia } from "../lib/useAtualizar";
import { NuviLogo } from "../components/brand/NuviLogo";
import { NuviLoader } from "../components/brand/NuviLoader";
import { Button } from "../components/ui/Button";
import { Sheet } from "../components/ui/Sheet";
import { Skeleton } from "../components/ui/Skeleton";
import { MacroBarras } from "../components/diary/MacroBarras";
import { EstimateBadge } from "../components/diary/EstimateBadge";
import { FaixaDeDias } from "../components/hoje/FaixaDeDias";
import { Medidor } from "../components/hoje/Medidor";
import { CartaoAgente } from "../components/hoje/CartaoAgente";
import { HojeSlots } from "../components/hoje/HojeSlots";
import { PullToRefresh } from "../components/PullToRefresh";
import { ROUTES } from "../routes";
import type { DiaryDay, DiaryDaySlot, MealSlot, Profile, User } from "../types";

interface WeightData {
  date: string;
  weight: number;
}

const ICONE_SLOT: Record<MealSlot, LucideIcon> = {
  cafe_da_manha: Coffee,
  lanche_manha: Cookie,
  almoco: Soup,
  lanche_tarde: Sandwich,
  jantar: Salad,
  ceia: Moon,
};

function getLevel(score = 0) {
  if (score < 50) return "Iniciante";
  if (score < 200) return "Cozinheiro";
  if (score < 500) return "Chef";
  return "MasterChef";
}

function saudacao(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

/**
 * Hoje — "o que eu como hoje, e quanto ainda cabe?" (protótipo, `hoje()`).
 *
 * Todo o dado do diário vem de UMA chamada (`GET /diary?date=`, D-4 do ADR-0001). Nada aqui
 * soma nem arredonda valor nutricional: os números saem literais de `totals` e
 * `slots[].logged_calories` (§ 9.3).
 */
export function Hoje() {
  const navigate = useNavigate();
  const diary = useDiaryDay();
  const atualizar = useAtualizarDia(diary);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [history, setHistory] = useState<WeightData[]>([]);
  const [menuAberto, setMenuAberto] = useState(false);

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
        // Perfil ainda não preenchido — a tela segue, e o "Próximo passo" convida a completá-lo.
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
  const primeiroNome = (user?.full_name || "").trim().split(/\s+/)[0] || "Visitante";

  function irParaRegistro(slot?: MealSlot) {
    const params = new URLSearchParams({ date: diary.date });
    if (slot) params.set("slot", slot);
    navigate(`${ROUTES.diario}?${params.toString()}`);
  }

  return (
    <PullToRefresh onRefresh={atualizar}>
      <div className="space-y-1">
        {/* TOPO (celular): logo, sino de lembretes e avatar ------------------- */}
        <div className="flex items-center gap-2.5 md:hidden">
          <div className="flex-1" data-splash-target>
            <NuviLogo size={28} />
          </div>
          <Link
            to={ROUTES.lembretes}
            aria-label="Lembretes"
            className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-card text-ink active:scale-[.97]"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
          </Link>
          <button
            type="button"
            aria-label="Conta"
            onClick={() => setMenuAberto(true)}
            className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-act-soft text-base font-black text-act-text active:scale-[.97]"
          >
            {primeiroNome.charAt(0).toUpperCase()}
          </button>
        </div>

        <div className="pt-2">
          <h1 className="text-[26px] font-black leading-[1.05] tracking-[-0.025em]">
            {saudacao()}, <span className="text-act-text">{primeiroNome}</span>.
          </h1>
          <p className="text-[13px] font-semibold text-mut">
            {diary.date === hoje ? formatDiaryDate(diary.date) : `${relativeDayLabel(diary.date, hoje)} · ${formatDiaryDate(diary.date)}`}
          </p>
        </div>

        <FaixaDeDias date={diary.date} onSelect={diary.goToDate} />

        {/* Estado assíncrono anunciado — sem isto o leitor de tela não sabe que o dia trocou. */}
        <p role="status" aria-live="polite" className="sr-only">
          {diary.status === "loading"
            ? "Carregando o seu dia."
            : diary.status === "error"
              ? `Erro ao carregar o dia: ${diary.error}`
              : diary.day
                ? `Dia ${diary.date} carregado. ${formatKcal(diary.day.totals.calories)} quilocalorias registradas.`
                : ""}
        </p>

        {diary.status === "loading" && <HojeSkeleton />}

        {diary.status === "error" && (
          <ErrorCard message={diary.error ?? "Erro desconhecido."} onRetry={diary.reload} />
        )}

        {diary.status === "ready" && diary.day && (
          <div className="grid gap-x-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-2.5">
              {diary.isEmpty && (
                <EmptyDayCard onRegister={() => irParaRegistro()} onPlan={() => navigate(ROUTES.cardapioGerar)} />
              )}
              <EnergiaCard day={diary.day} onFixTarget={() => navigate(ROUTES.perfil)} />
              <HojeSlots.Agua date={diary.date} />
              <Refeicoes day={diary.day} onAdd={irParaRegistro} onOpen={() => navigate(`${ROUTES.diario}?date=${diary.date}`)} />
            </div>
            <div className="min-w-0 space-y-2.5">
              <CartaoAgente day={diary.day} profile={profile} hoje={hoje} />
              <ProximoPasso
                day={diary.day}
                hasCalorieTarget={Boolean(profile?.daily_calories)}
                hasWeightHistory={history.length > 0}
                onGo={(path) => navigate(path)}
              />
            </div>
          </div>
        )}
      </div>

      <MenuConta open={menuAberto} onOpenChange={setMenuAberto} user={user} />
    </PullToRefresh>
  );
}

// ---------------------------------------------------------------------------
// Peças da tela
// ---------------------------------------------------------------------------

/** Cartão "Seu dia": medidor de meia-lua e macros. */
function EnergiaCard({ day, onFixTarget }: { day: DiaryDay; onFixTarget: () => void }) {
  return (
    <section aria-labelledby="energia-do-dia" className="rounded-3xl bg-card px-4 py-3.5">
      <div className="flex justify-between text-[13px]">
        <b id="energia-do-dia">Energia do dia</b>
        <span className="text-mut">
          {day.calories_target !== null
            ? `${formatKcal(day.totals.calories)} de ${formatKcal(day.calories_target)} kcal registradas`
            : `${formatKcal(day.totals.calories)} kcal registradas`}
        </span>
      </div>
      {day.calories_target !== null ? (
        <Medidor consumidas={day.totals.calories} meta={day.calories_target} />
      ) : (
        <div className="py-6 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-mut">Ainda cabem</p>
          <p className="mt-3 text-sm text-mut">
            Defina a sua meta de calorias no perfil para acompanhar quanto ainda cabe no dia.
          </p>
          <Button variant="outline" onClick={onFixTarget} className="mt-3 px-3 py-1.5 text-xs">
            Definir meta
          </Button>
        </div>
      )}
      <MacroBarras day={day} />
    </section>
  );
}

function Refeicoes({
  day,
  onAdd,
  onOpen,
}: {
  day: DiaryDay;
  onAdd: (slot?: MealSlot) => void;
  onOpen: () => void;
}) {
  return (
    <section aria-label="Refeições do dia">
      <div className="flex items-center justify-between px-1 pb-1 pt-3">
        <h2 className="text-base font-extrabold">Refeições do dia</h2>
        <button type="button" onClick={onOpen} className="text-[12.5px] font-bold text-mut">
          ver diário
        </button>
      </div>
      {day.meal_plan && (
        <p className="px-1 pb-1.5 text-xs text-mut">
          Cardápio vigente: <strong className="font-semibold">{day.meal_plan.title}</strong> · {day.meal_plan.day_label}
        </p>
      )}
      <ol className="space-y-2">
        {day.slots.map((s) => (
          <LinhaRefeicao key={s.slot} slot={s} date={day.date} onAdd={() => onAdd(s.slot)} onOpen={onOpen} />
        ))}
      </ol>
      {day.entries_count >= 55 && (
        <p className="mt-3 text-xs text-act-text">{day.entries_count} de 60 registros usados neste dia.</p>
      )}
    </section>
  );
}

function LinhaRefeicao({
  slot,
  date,
  onAdd,
  onOpen,
}: {
  slot: DiaryDaySlot;
  date: string;
  onAdd: () => void;
  onOpen: () => void;
}) {
  const Icone = ICONE_SLOT[slot.slot];
  const temRegistro = slot.entries.length > 0 || slot.logged_calories > 0;
  const temPlano = slot.planned_meals.length > 0 || slot.planned_calories > 0;
  const vazio = !temRegistro;

  return (
    <li
      aria-label={
        temRegistro
          ? `${slot.label}: ${formatKcal(slot.logged_calories)} kcal registradas`
          : temPlano
            ? `${slot.label}: ${formatKcal(slot.planned_calories)} kcal planejadas`
            : slot.label
      }
      className={`flex items-center gap-3 rounded-[22px] px-3.5 py-3 ${
        vazio ? "border-2 border-dashed border-line" : "cursor-pointer bg-card"
      }`}
      onClick={vazio ? undefined : onOpen}
    >
      <div className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[14px] bg-act-soft text-act-text">
        <Icone className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <b className="block text-[15px]">{slot.label}</b>
        <span className="block truncate text-[12.5px] text-mut">
          {temRegistro ? (
            <>
              {slot.entries.length > 0 ? slot.entries.map((e) => e.food_name).join(", ") : "registrado"}{" "}
              {slot.entries.some((e) => e.is_estimate) && <EstimateBadge isEstimate compact />}
            </>
          ) : temPlano ? (
            <>
              {slot.planned_meals.length > 0 ? slot.planned_meals.map((m) => m.title).join(", ") : "cardápio"}{" "}
              <span className="text-[10px] font-semibold uppercase tracking-wide">planejado</span>
            </>
          ) : (
            "ainda vazio"
          )}
        </span>
      </div>
      {temRegistro ? (
        <b className="text-[15px] tabular-nums">{formatKcal(slot.logged_calories)}</b>
      ) : (
        <>
          {temPlano && (
            <span className="text-sm font-bold tabular-nums text-mut">{formatKcal(slot.planned_calories)}</span>
          )}
          <HojeSlots.Repetir date={date} slot={slot.slot} />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            aria-label={`Registrar ${slot.label.toLowerCase()}`}
            className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-xl bg-act text-on-act active:scale-[.97]"
          >
            <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </>
      )}
    </li>
  );
}

function ProximoPasso({
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
    <section className="rounded-3xl bg-card px-4 py-3.5">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-mut">Próximo passo</p>
      <div className="space-y-2">
        {passos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onGo(p.path)}
            className="flex w-full items-center gap-3 rounded-2xl border border-line px-3 py-2.5 text-left active:scale-[.99]"
          >
            <Sparkles aria-hidden="true" className="h-4 w-4 shrink-0 text-act-text" />
            <span className="min-w-0">
              <span className="block text-sm font-extrabold">{p.title}</span>
              <span className="block text-xs text-mut">{p.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Vazio de usuário novo: nada registrado e nenhum cardápio no calendário. */
function EmptyDayCard({ onRegister, onPlan }: { onRegister: () => void; onPlan: () => void }) {
  return (
    <section className="rounded-3xl border-2 border-dashed border-line p-5 text-center">
      <h2 className="text-lg font-black">Seu dia está em branco — vamos preencher?</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-mut">
        Registre o que você comeu e o medidor começa a se desenhar aqui. Se preferir, gere um cardápio e o dia já nasce
        planejado.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button onClick={onRegister}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          Registrar primeira refeição
        </Button>
        <Button variant="outline" onClick={onPlan}>
          <Sparkles aria-hidden="true" className="h-4 w-4" />
          Gerar um cardápio
        </Button>
      </div>
    </section>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="rounded-3xl bg-card p-6 text-center">
      <h2 className="text-base font-black">Não conseguimos carregar o seu dia</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-mut">{message}</p>
      <Button variant="outline" onClick={onRetry} className="mt-4">
        <RefreshCw aria-hidden="true" className="h-4 w-4" />
        Tentar de novo
      </Button>
    </section>
  );
}

function HojeSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-2.5">
      <Skeleton className="h-72 rounded-3xl" />
      <Skeleton className="h-16 rounded-[22px]" />
      <Skeleton className="h-16 rounded-[22px]" />
      <div className="flex justify-center py-2">
        <NuviLoader active label="Carregando o seu dia" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avatar → folha da conta
// ---------------------------------------------------------------------------

function alternarTema() {
  const root = document.documentElement;
  const escuro = !root.classList.contains("dark");
  root.classList.toggle("dark", escuro);
  try {
    localStorage.setItem("theme", escuro ? "dark" : "light");
  } catch {
    /* sem armazenamento */
  }
  window.dispatchEvent(new Event("nuvi:tema"));
}

function MenuConta({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user: User | null;
}) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const itens: Array<[LucideIcon, string, string]> = [
    [UserRound, "Perfil e metas", ROUTES.perfil],
    [TrendingDown, "Progresso", ROUTES.progresso],
    [Package, "Meus alimentos", ROUTES.alimentos],
    [Bell, "Lembretes", ROUTES.lembretes],
    [Crown, "Assinatura", ROUTES.assinatura],
  ];
  if (user?.is_superuser) itens.push([Shield, "Painel Admin", "/admin"]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={user?.full_name || "Sua conta"}>
      <p className="-mt-1 mb-2 text-[12.5px] font-semibold text-mut">
        {getLevel(user?.score)} · {user?.score || 0} XP
      </p>
      <div>
        {itens.map(([Icone, nome, to]) => (
          <button
            key={to}
            type="button"
            onClick={() => {
              onOpenChange(false);
              navigate(to);
            }}
            className="flex w-full items-center gap-3 border-b border-line px-1 py-3.5 text-left text-[14.5px] font-bold"
          >
            <Icone className="h-5 w-5 text-act-text" aria-hidden="true" />
            <span className="flex-1">{nome}</span>
            <ChevronRight className="h-4 w-4 text-mut" aria-hidden="true" />
          </button>
        ))}
        <button
          type="button"
          onClick={alternarTema}
          className="flex w-full items-center gap-3 border-b border-line px-1 py-3.5 text-left text-[14.5px] font-bold"
        >
          <Sun className="h-5 w-5 text-act-text dark:hidden" aria-hidden="true" />
          <Moon className="hidden h-5 w-5 text-act-text dark:block" aria-hidden="true" />
          <span className="flex-1">Alternar tema claro e escuro</span>
        </button>
        <button
          type="button"
          onClick={() => {
            logout?.();
            navigate("/");
          }}
          className="flex w-full items-center gap-3 px-1 py-3.5 text-left text-[14.5px] font-bold text-red-600 dark:text-red-400"
        >
          Sair
        </button>
      </div>
    </Sheet>
  );
}
