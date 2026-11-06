import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Coffee,
  Cookie,
  Loader2,
  MoreHorizontal,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  Salad,
  Sandwich,
  Search,
  Soup,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAlert } from "../lib/AlertContext";
import {
  formatDayShort,
  formatDensity,
  formatKcal,
  formatQuantity,
  quantidadePadraoPara,
  relativeDayLabel,
  toIsoDate,
} from "../lib/diary";
import { useDiaryDay } from "../lib/useDiaryDay";
import { useAtualizarDia } from "../lib/useAtualizar";
import { PullToRefresh } from "../components/PullToRefresh";
import { SwipeRow } from "../components/diary/SwipeRow";
import { MenuRefeicao } from "../components/diary/MenusDoDiario";
import { DiaMenuButton } from "../components/diary/DiaMenuButton";
import { apagarComDesfazer } from "../components/diary/apagarComDesfazer";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Sheet } from "../components/ui/Sheet";
import { Skeleton } from "../components/ui/Skeleton";
import {
  SEARCH_MAX_LENGTH,
  SEARCH_MIN_LENGTH,
  useFoodSearch,
} from "../lib/useFoodSearch";
import { EstimateBadge } from "../components/diary/EstimateBadge";
import {
  DIARY_UNIT_LABELS,
  MEAL_SLOT_LABELS,
  MEAL_SLOT_ORDER,
  type DiaryDay,
  type DiaryDaySlot,
  type DiaryEntry,
  type DiaryUnit,
  type FoodBaseUnit,
  type FoodOption,
  type MealSlot,
} from "../types";

/** RS-07: `quantity` tem `gt=0, le=10_000`. A checagem aqui é conforto — quem
 *  protege é o servidor, que revalida o mesmo limite. */
const QUANTIDADE_MAX = 10_000;

const ICONE_SLOT: Record<MealSlot, LucideIcon> = {
  cafe_da_manha: Coffee,
  lanche_manha: Cookie,
  almoco: Soup,
  lanche_tarde: Sandwich,
  jantar: Salad,
  ceia: Moon,
};

const CAMPO =
  "w-full rounded-2xl border border-line bg-card px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-act-text";

function isMealSlot(value: string | null): value is MealSlot {
  return value !== null && (MEAL_SLOT_ORDER as readonly string[]).includes(value);
}

/**
 * Tela de registro de alimentação.
 *
 * Fluxo de dois passos, imposto pelo contrato (D-5): **achar** o alimento
 * (`GET /diary/foods/search`, ou `POST /diary/foods/resolve` quando o catálogo
 * não tem) e depois **registrar** (`POST /diary` com o `food_ref` opaco). O
 * `POST` nunca recebe nome de alimento nem caloria.
 *
 * Toda mutação devolve o `DiaryDay` recalculado (D-6): a lista abaixo se
 * atualiza a partir da resposta, sem refetch e sem soma no cliente.
 */
export function DiaryLog() {
  const [params, setParams] = useSearchParams();
  const { showAlert, confirmDialog } = useAlert();

  const dataInicial = params.get("date") ?? toIsoDate(new Date());
  const diary = useDiaryDay(dataInicial);
  const busca = useFoodSearch();

  const slotDaUrl = params.get("slot");
  const [slot, setSlot] = useState<MealSlot>(isMealSlot(slotDaUrl) ? slotDaUrl : "cafe_da_manha");
  const [selecionado, setSelecionado] = useState<FoodOption | null>(null);
  const [editando, setEditando] = useState<DiaryEntry | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const atualizar = useAtualizarDia(diary);

  // Mantém a URL em dia para que recarregar a página caia no mesmo dia.
  useEffect(() => {
    setParams(
      (atual) => {
        const novo = new URLSearchParams(atual);
        novo.set("date", diary.date);
        return novo;
      },
      { replace: true },
    );
  }, [diary.date, setParams]);

  const hoje = toIsoDate(new Date());

  async function registrar(quantity: number, unit: DiaryUnit) {
    if (!selecionado) return;
    try {
      await diary.addEntry({
        entry_date: diary.date,
        meal_slot: slot,
        food_ref: selecionado.food_ref,
        quantity,
        unit,
      });
      showAlert(`${selecionado.name} adicionado em ${MEAL_SLOT_LABELS[slot]}.`, "success");
      setSelecionado(null);
      setAdicionando(false);
      busca.clear();
    } catch (err) {
      showAlert((err as Error).message, "error");
    }
  }

  async function salvarEdicao(entry: DiaryEntry, quantity: number, novoSlot: MealSlot) {
    try {
      // Corpo parcial: só o que mudou. Campo fora da lista de § 6.6 vira 422.
      const body: { quantity?: number; meal_slot?: MealSlot } = {};
      if (quantity !== entry.quantity) body.quantity = quantity;
      if (novoSlot !== entry.meal_slot) body.meal_slot = novoSlot;

      if (Object.keys(body).length === 0) {
        setEditando(null);
        return;
      }

      await diary.updateEntry(entry.id, body);
      showAlert("Registro atualizado.", "success");
      setEditando(null);
    } catch (err) {
      showAlert((err as Error).message, "error");
    }
  }

  async function apagar(entry: DiaryEntry) {
    const ok = await confirmDialog(`Apagar "${entry.food_name}" do seu diário?`, {
      confirmLabel: "Apagar",
      danger: true,
    });
    if (!ok) return;
    try {
      await diary.removeEntry(entry.id);
      showAlert("Registro apagado.", "success");
    } catch (err) {
      showAlert((err as Error).message, "error");
    }
  }

  function abrirAdicionar(s?: MealSlot) {
    if (s) setSlot(s);
    setAdicionando(true);
  }

  const dia = diary.day;
  const noPlano = dia && dia.calories_target !== null ? dia.totals.calories <= dia.calories_target : null;

  return (
    <PullToRefresh onRefresh={atualizar}>
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-black leading-[1.05] tracking-[-0.025em]">Diário</h1>
            <p className="text-[13px] font-semibold text-mut">{relativeDayLabel(diary.date, hoje)}</p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Dia anterior"
              onClick={() => diary.shiftDay(-1)}
              disabled={diary.mutating}
              className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-card text-ink active:scale-[.97] disabled:opacity-40"
            >
              <ChevronLeft aria-hidden="true" className="h-5 w-5" />
            </button>
            {/* Mostra a DATA em foco, não um rótulo fixo. Continua levando para hoje
                quando clicado, mas quem manda no texto é o dia que está sendo visto. */}
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
              className="min-w-16 text-center text-[13px] font-extrabold tabular-nums disabled:opacity-100"
            >
              {formatDayShort(diary.date, hoje)}
            </button>
            <button
              type="button"
              aria-label="Próximo dia"
              onClick={() => diary.shiftDay(1)}
              disabled={diary.mutating}
              className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-card text-ink active:scale-[.97] disabled:opacity-40"
            >
              <ChevronRight aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        </div>

        <p role="status" aria-live="polite" className="sr-only">
          {diary.status === "loading"
            ? "Carregando os registros do dia."
            : diary.status === "error"
              ? `Erro: ${diary.error}`
              : dia
                ? `${dia.entries_count} registros no dia.`
                : ""}
        </p>

        {dia && (
          <div className="mt-2 flex items-center justify-between rounded-3xl bg-card px-4 py-3">
            <span className="text-[13.5px]">
              <b>{formatKcal(dia.totals.calories)}</b>
              {dia.calories_target !== null ? ` de ${formatKcal(dia.calories_target)} kcal` : " kcal"}
              {noPlano !== null && (
                <>
                  {" · "}
                  <b className="text-pos-text">{noPlano ? "no plano" : "acima"}</b>
                </>
              )}
            </span>
            <div className="flex items-center gap-2">
              <DiaMenuButton data={diary.date} day={dia} />
              <Button onClick={() => abrirAdicionar()} className="px-3 py-1.5 text-xs">
                <Plus aria-hidden="true" className="h-4 w-4" />
                Adicionar alimento
              </Button>
            </div>
          </div>
        )}

        {diary.status === "loading" && (
          <div aria-hidden="true" className="space-y-2 pt-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-3xl" />
            ))}
          </div>
        )}

        {diary.status === "error" && (
          <div className="mt-3 rounded-3xl bg-card p-5 text-center">
            <p className="text-sm text-mut">{diary.error}</p>
            <Button variant="outline" onClick={diary.reload} className="mt-3 px-3 py-1.5 text-xs">
              <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
              Tentar de novo
            </Button>
          </div>
        )}

        {diary.status === "ready" && dia && (
          <LoggedList
            day={dia}
            editando={editando}
            mutating={diary.mutating}
            onAdd={abrirAdicionar}
            onEdit={setEditando}
            onCancelEdit={() => setEditando(null)}
            onSave={salvarEdicao}
            onDelete={apagar}
          />
        )}
      </div>

      {/* ---------------------------------------------------- ADICIONAR */}
      <Sheet
        open={adicionando}
        onOpenChange={(o) => {
          setAdicionando(o);
          if (!o) setSelecionado(null);
        }}
        title="Adicionar alimento"
        description={`${relativeDayLabel(diary.date, hoje)} · busque o alimento, escolha a porção e a refeição.`}
      >
        <fieldset className="mb-4">
          <legend className="mb-2 text-[11px] font-bold uppercase tracking-wider text-mut">Refeição</legend>
          <div className="flex flex-wrap gap-1.5">
            {MEAL_SLOT_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={slot === s}
                onClick={() => setSlot(s)}
                className={`rounded-full px-3.5 py-2 text-[12.5px] font-bold active:scale-[.97] ${
                  slot === s ? "bg-ink text-bg" : "bg-soft text-ink"
                }`}
              >
                {MEAL_SLOT_LABELS[s]}
              </button>
            ))}
          </div>
        </fieldset>

        {selecionado ? (
          <PortionForm
            food={selecionado}
            slotLabel={MEAL_SLOT_LABELS[slot]}
            submitting={diary.mutating}
            onCancel={() => setSelecionado(null)}
            onSubmit={registrar}
          />
        ) : (
          <FoodSearchPanel busca={busca} onPick={setSelecionado} />
        )}
      </Sheet>
    </PullToRefresh>
  );
}

// ---------------------------------------------------------------------------
// Busca
// ---------------------------------------------------------------------------

function FoodSearchPanel({
  busca,
  onPick,
}: {
  busca: ReturnType<typeof useFoodSearch>;
  onPick: (f: FoodOption) => void;
}) {
  const [unidadeResolve, setUnidadeResolve] = useState<FoodBaseUnit>("g");
  const [erroResolve, setErroResolve] = useState<string | null>(null);

  async function estimar() {
    setErroResolve(null);
    try {
      const opcao = await busca.resolveWithAi(unidadeResolve);
      onPick(opcao);
    } catch (err) {
      setErroResolve((err as Error).message);
    }
  }

  return (
    <div>
      <label htmlFor="busca-alimento" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-mut">
        Buscar alimento
      </label>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mut" />
        <Input
          id="busca-alimento"
          type="search"
          autoComplete="off"
          maxLength={SEARCH_MAX_LENGTH}
          value={busca.term}
          onChange={(e) => busca.setTerm(e.target.value)}
          placeholder="arroz, frango, banana…"
          aria-describedby="busca-ajuda"
          className="pl-10 pr-10 font-semibold"
        />
        {busca.status === "searching" && (
          <Loader2
            aria-hidden="true"
            className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mut motion-safe:animate-spin"
          />
        )}
      </div>
      <p id="busca-ajuda" className="mt-1.5 text-xs text-mut">
        A partir de {SEARCH_MIN_LENGTH} letras. Buscamos na tabela TACO.
      </p>

      <p role="status" aria-live="polite" className="sr-only">
        {busca.status === "searching"
          ? "Buscando alimentos."
          : busca.status === "ready"
            ? `${busca.results.length} alimentos encontrados.`
            : busca.status === "error"
              ? `Erro na busca: ${busca.error}`
              : ""}
      </p>

      {busca.status === "error" && (
        <p className="mt-3 rounded-2xl bg-act-soft p-3 text-sm text-act-text">{busca.error}</p>
      )}

      {busca.status === "ready" && busca.results.length > 0 && (
        <ul className="mt-3 overflow-hidden rounded-[22px] bg-bg">
          {busca.results.map((f) => (
            <li key={f.food_ref} className="border-b border-line last:border-b-0">
              <button
                type="button"
                onClick={() => onPick(f)}
                className="flex w-full items-center gap-2 px-3.5 py-3 text-left active:bg-soft"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-bold">{f.name}</span>
                    <EstimateBadge isEstimate={f.is_estimate} compact />
                  </span>
                  <span className="block text-xs text-mut">{formatDensity(f.kcal_per_base_unit, f.base_unit)}</span>
                </span>
                <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl bg-act text-on-act">
                  <Plus aria-hidden="true" className="h-[18px] w-[18px]" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* § 6.1: `suggest_resolve` só vem true quando não houve resultado. É o
          gatilho do único caminho pago — e ele exige clique explícito. */}
      {busca.status === "ready" && busca.suggestResolve && (
        <div className="mt-3 rounded-[22px] border-2 border-dashed border-line p-4">
          <p className="text-sm font-extrabold">Não achamos “{busca.term.trim()}” na tabela.</p>
          <p className="mt-1 text-xs text-mut">
            Podemos estimar os valores com IA. O resultado fica marcado como estimativa e conta na sua cota do plano.
          </p>

          <fieldset className="mt-3">
            <legend className="text-xs font-semibold text-mut">Como você mede esse alimento?</legend>
            <div className="mt-1.5 flex gap-1.5">
              {(["g", "ml", "un"] as FoodBaseUnit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  aria-pressed={unidadeResolve === u}
                  onClick={() => setUnidadeResolve(u)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${
                    unidadeResolve === u ? "bg-ink text-bg" : "bg-soft text-ink"
                  }`}
                >
                  {DIARY_UNIT_LABELS[u]}
                </button>
              ))}
            </div>
          </fieldset>

          {erroResolve && <p className="mt-3 text-sm text-act-text">{erroResolve}</p>}

          <Button variant="outline" onClick={estimar} disabled={busca.resolving} className="mt-3 px-3 py-2">
            {busca.resolving ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
            ) : (
              <Sparkles aria-hidden="true" className="h-4 w-4" />
            )}
            Estimar com IA
          </Button>
        </div>
      )}

      {busca.status === "idle" && (
        <p className="mt-6 text-center text-sm text-mut">Digite o nome de um alimento para começar.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Porção
// ---------------------------------------------------------------------------

function PortionForm({
  food,
  slotLabel,
  submitting,
  onCancel,
  onSubmit,
}: {
  food: FoodOption;
  slotLabel: string;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (quantity: number, unit: DiaryUnit) => void;
}) {
  // § 9.2: o seletor sai de `allowed_units`, nunca da lista completa das 8
  // unidades. A regra de compatibilidade mora no servidor, em um lugar só.
  const [unit, setUnit] = useState<DiaryUnit>(food.allowed_units[0] ?? food.base_unit);
  // Depende da unidade: `100` para g/ml, `1` para unidade de contagem.
  const [quantity, setQuantity] = useState(() =>
    String(quantidadePadraoPara(food.allowed_units[0] ?? food.base_unit)),
  );
  const [erro, setErro] = useState<string | null>(null);
  const quantidadeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    quantidadeRef.current?.focus();
    quantidadeRef.current?.select();
  }, []);

  function submeter(e: React.FormEvent) {
    e.preventDefault();
    const valor = Number(quantity.replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      setErro("Informe uma quantidade maior que zero.");
      return;
    }
    if (valor > QUANTIDADE_MAX) {
      setErro(`A quantidade máxima por registro é ${QUANTIDADE_MAX.toLocaleString("pt-BR")}.`);
      return;
    }
    setErro(null);
    onSubmit(valor, unit);
  }

  return (
    <form onSubmit={submeter}>
      <div className="rounded-[22px] bg-bg p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-[15px] font-extrabold">{food.name}</p>
              <EstimateBadge isEstimate={food.is_estimate} />
            </div>
            <p className="mt-0.5 text-xs text-mut">Vai para {slotLabel}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Escolher outro alimento"
            className="shrink-0 rounded-xl p-1.5 text-mut active:scale-[.97]"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        {food.is_estimate && (
          <p className="mt-2 text-xs text-act-text">Estes valores são uma estimativa, não vieram de tabela oficial.</p>
        )}

        <div className="mt-4 flex gap-2">
          <div className="w-28">
            <label htmlFor="porcao-quantidade" className="mb-1 block text-xs font-semibold text-mut">
              Quantidade
            </label>
            <input
              id="porcao-quantidade"
              ref={quantidadeRef}
              type="text"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={`${CAMPO} tabular-nums`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor="porcao-unidade" className="mb-1 block text-xs font-semibold text-mut">
              Unidade
            </label>
            <select
              id="porcao-unidade"
              value={unit}
              // Trocar de unidade reajusta a quantidade: 250 g virando 250 unidades é
              // o mesmo defeito por outro caminho.
              onChange={(e) => {
                const nova = e.target.value as DiaryUnit;
                setUnit(nova);
                setQuantity(String(quantidadePadraoPara(nova)));
              }}
              className={CAMPO}
            >
              {food.allowed_units.map((u) => (
                <option key={u} value={u}>
                  {DIARY_UNIT_LABELS[u]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {erro && (
          <p role="alert" className="mt-2 text-xs text-act-text">
            {erro}
          </p>
        )}

        <Button type="submit" disabled={submitting} className="mt-4 w-full">
          {submitting ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
          ) : (
            <Plus aria-hidden="true" className="h-4 w-4" />
          )}
          Adicionar ao diário
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Registrado
// ---------------------------------------------------------------------------

function LoggedList({
  day,
  editando,
  mutating,
  onAdd,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: {
  day: DiaryDay;
  editando: DiaryEntry | null;
  mutating: boolean;
  onAdd: (slot: MealSlot) => void;
  onEdit: (e: DiaryEntry) => void;
  onCancelEdit: () => void;
  onSave: (entry: DiaryEntry, quantity: number, slot: MealSlot) => void;
  onDelete: (e: DiaryEntry) => void;
}) {
  return (
    <div>
      {day.entries_count === 0 && (
        <div className="mt-3 rounded-3xl border-2 border-dashed border-line p-6 text-center">
          <p className="text-sm font-extrabold">Nada registrado ainda neste dia.</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-mut">
            Toque no + de uma refeição e busque o alimento: ele aparece aqui, com as calorias somadas pelo servidor.
          </p>
        </div>
      )}

      {day.slots.map((s) => {
        const Icone = ICONE_SLOT[s.slot];
        const temEntradas = s.entries.length > 0;
        return (
          <section key={s.slot} aria-label={s.label}>
            <div className="flex items-center justify-between px-1 pb-1 pt-4">
              <h2 className="flex items-center gap-1.5 text-[15px] font-extrabold">
                <Icone aria-hidden="true" className="h-[17px] w-[17px] text-act-text" />
                {s.label}
                {temEntradas && <span className="tabular-nums"> · {formatKcal(s.logged_calories)}</span>}
              </h2>
              <div className="flex items-center gap-1.5">
              {temEntradas && <MenuDaRefeicao slot={s} />}
              <button
                type="button"
                onClick={() => onAdd(s.slot)}
                aria-label={`Adicionar em ${s.label}`}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-act text-on-act active:scale-[.97]"
              >
                <Plus aria-hidden="true" className="h-[18px] w-[18px]" />
              </button>
              </div>
            </div>

            {temEntradas ? (
              <ul className="overflow-hidden rounded-[22px] bg-card">
                {s.entries.map((e) =>
                  editando?.id === e.id ? (
                    <li key={e.id} className="border-b border-line p-2 last:border-b-0">
                      <EntryEditForm entry={e} submitting={mutating} onCancel={onCancelEdit} onSave={onSave} />
                    </li>
                  ) : (
                    <li key={e.id} className="border-b border-line last:border-b-0">
                    <SwipeRow label={e.food_name} disabled={mutating} onDelete={() => void apagarComDesfazer(e)}>
                    <div className="flex items-center gap-2.5 px-3.5 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <b className="text-sm">{e.food_name}</b>
                          <EstimateBadge isEstimate={e.is_estimate} compact />
                        </div>
                        <span className="block text-xs text-mut">
                          {formatQuantity(e.quantity)} {DIARY_UNIT_LABELS[e.unit]} · {formatKcal(e.calories_total)} kcal
                        </span>
                      </div>

                      {/* `disabled` durante a mutação: sem isto, dois cliques rápidos em
                          apagar disparam duas exclusões concorrentes. */}
                      <button
                        type="button"
                        onClick={() => onEdit(e)}
                        disabled={mutating}
                        aria-label={`Editar ${e.food_name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-mut disabled:opacity-40"
                      >
                        <Pencil aria-hidden="true" className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(e)}
                        disabled={mutating}
                        aria-label={`Apagar ${e.food_name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-mut disabled:opacity-40"
                      >
                        <X aria-hidden="true" className="h-4 w-4" />
                      </button>
                    </div>
                    </SwipeRow>
                    </li>
                  ),
                )}
              </ul>
            ) : (
              <div className="rounded-[18px] border-2 border-dashed border-line px-3 py-3 text-[13px] text-mut">
                Nada ainda.
                {s.planned_meals.length > 0 && (
                  <>
                    {" "}
                    O cardápio sugere <b className="text-act-text">{s.planned_meals.map((m) => m.title).join(", ")}</b>.
                  </>
                )}
              </div>
            )}
          </section>
        );
      })}

      {day.has_estimate && (
        <p className="mt-4 text-xs text-act-text">Este dia tem alimentos com valores estimados, marcados na lista.</p>
      )}
    </div>
  );
}

function EntryEditForm({
  entry,
  submitting,
  onCancel,
  onSave,
}: {
  entry: DiaryEntry;
  submitting: boolean;
  onCancel: () => void;
  onSave: (entry: DiaryEntry, quantity: number, slot: MealSlot) => void;
}) {
  const [quantity, setQuantity] = useState(String(entry.quantity));
  const [slot, setSlot] = useState<MealSlot>(entry.meal_slot);
  const [erro, setErro] = useState<string | null>(null);

  function submeter(e: React.FormEvent) {
    e.preventDefault();
    const valor = Number(quantity.replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0 || valor > QUANTIDADE_MAX) {
      setErro("Quantidade inválida.");
      return;
    }
    setErro(null);
    onSave(entry, valor, slot);
  }

  return (
    <form onSubmit={submeter} className="rounded-2xl bg-bg p-3" aria-label={`Editando ${entry.food_name}`}>
      <p className="mb-2 text-sm font-extrabold">{entry.food_name}</p>

      <div className="flex flex-wrap gap-2">
        <div className="w-24">
          <label htmlFor={`edit-qtd-${entry.id}`} className="mb-1 block text-xs font-semibold text-mut">
            Quantidade
          </label>
          <input
            id={`edit-qtd-${entry.id}`}
            type="text"
            inputMode="decimal"
            autoFocus
            value={quantity}
            onChange={(ev) => setQuantity(ev.target.value)}
            className={`${CAMPO} tabular-nums`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <label htmlFor={`edit-slot-${entry.id}`} className="mb-1 block text-xs font-semibold text-mut">
            Refeição
          </label>
          <select
            id={`edit-slot-${entry.id}`}
            value={slot}
            onChange={(ev) => setSlot(ev.target.value as MealSlot)}
            className={CAMPO}
          >
            {MEAL_SLOT_ORDER.map((s) => (
              <option key={s} value={s}>
                {MEAL_SLOT_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* A unidade não é editável aqui de propósito: `DiaryEntry` traz
          `base_unit`, mas não traz `allowed_units`, e o § 9.2 proíbe o
          frontend de manter a tabela de compatibilidade unidade×alimento.
          Trocar a unidade = apagar e registrar de novo. */}
      <p className="mt-2 text-xs text-mut">
        Unidade: {DIARY_UNIT_LABELS[entry.unit]}. Para trocar a unidade, apague e registre de novo.
      </p>

      {erro && (
        <p role="alert" className="mt-2 text-xs text-act-text">
          {erro}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <Button type="submit" disabled={submitting} className="px-3 py-1.5 text-xs">
          Salvar
        </Button>
        <Button variant="outline" onClick={onCancel} className="px-3 py-1.5 text-xs">
          Cancelar
        </Button>
      </div>
    </form>
  );
}


/** Botão "⋯" da refeição com o menu de copiar, salvar como pronta e apagar. */
function MenuDaRefeicao({ slot }: { slot: DiaryDaySlot }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} aria-label={`Menu de ${slot.label}`} className="flex h-8 w-8 items-center justify-center rounded-xl bg-soft text-ink active:scale-[.97]">
        <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
      </button>
      <MenuRefeicao aberto={aberto} onFechar={() => setAberto(false)} nome={slot.label} slot={slot.slot} data={slot.entries[0].entry_date} entradas={slot.entries} />
    </>
  );
}
