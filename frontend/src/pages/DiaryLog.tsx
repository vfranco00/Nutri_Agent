import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useAlert } from "../lib/AlertContext";
import {
  formatDensity,
  formatKcal,
  formatQuantity,
  quantidadePadraoPara,
  relativeDayLabel,
  toIsoDate,
} from "../lib/diary";
import { useDiaryDay } from "../lib/useDiaryDay";
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
  type DiaryEntry,
  type DiaryUnit,
  type FoodBaseUnit,
  type FoodOption,
  type MealSlot,
} from "../types";

/** RS-07: `quantity` tem `gt=0, le=10_000`. A checagem aqui é conforto — quem
 *  protege é o servidor, que revalida o mesmo limite. */
const QUANTIDADE_MAX = 10_000;

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-white">
            Registrar alimentação
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {relativeDayLabel(diary.date, hoje)} · busque o alimento, escolha a porção e a refeição.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Dia anterior"
            onClick={() => diary.shiftDay(-1)}
            disabled={diary.mutating}
            className="rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-600 hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 motion-safe:transition-colors disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:focus-visible:ring-offset-zinc-950"
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => diary.goToDate(hoje)}
            disabled={diary.date === hoje || diary.mutating}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 motion-safe:transition-colors disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:focus-visible:ring-offset-zinc-950"
          >
            Hoje
          </button>
          <button
            type="button"
            aria-label="Próximo dia"
            onClick={() => diary.shiftDay(1)}
            disabled={diary.mutating}
            className="rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-600 hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 motion-safe:transition-colors disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:focus-visible:ring-offset-zinc-950"
          >
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---------------------------------------------------- ADICIONAR */}
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">
            Adicionar alimento
          </h2>

          <fieldset className="mb-4">
            <legend className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Refeição
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {MEAL_SLOT_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={slot === s}
                  onClick={() => setSlot(s)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 motion-safe:transition-colors dark:focus-visible:ring-offset-zinc-900 ${
                    slot === s
                      ? "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400"
                      : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400"
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
        </section>

        {/* ---------------------------------------------------- REGISTRADO */}
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
              Registrado em {relativeDayLabel(diary.date, hoje).toLowerCase()}
            </h2>
            {diary.day && (
              <span className="text-sm font-bold tabular-nums text-zinc-900 dark:text-white">
                {formatKcal(diary.day.totals.calories)}{" "}
                <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">kcal</span>
              </span>
            )}
          </div>

          <p role="status" aria-live="polite" className="sr-only">
            {diary.status === "loading"
              ? "Carregando os registros do dia."
              : diary.status === "error"
                ? `Erro: ${diary.error}`
                : diary.day
                  ? `${diary.day.entries_count} registros no dia.`
                  : ""}
          </p>

          {diary.status === "loading" && (
            <div aria-hidden="true" className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-12 rounded-lg bg-zinc-100 motion-safe:animate-pulse dark:bg-zinc-800"
                />
              ))}
            </div>
          )}

          {diary.status === "error" && (
            <div className="rounded-lg border border-red-200 p-4 text-center dark:border-red-900/50">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{diary.error}</p>
              <button
                type="button"
                onClick={diary.reload}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 motion-safe:transition-colors dark:border-zinc-700 dark:text-zinc-200 dark:focus-visible:ring-offset-zinc-900"
              >
                <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                Tentar de novo
              </button>
            </div>
          )}

          {diary.status === "ready" && diary.day && (
            <LoggedList
              day={diary.day}
              editando={editando}
              mutating={diary.mutating}
              onEdit={setEditando}
              onCancelEdit={() => setEditando(null)}
              onSave={salvarEdicao}
              onDelete={apagar}
            />
          )}
        </section>
      </div>
    </div>
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
      <label
        htmlFor="busca-alimento"
        className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
      >
        Buscar alimento
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
        />
        <input
          id="busca-alimento"
          type="search"
          autoComplete="off"
          maxLength={SEARCH_MAX_LENGTH}
          value={busca.term}
          onChange={(e) => busca.setTerm(e.target.value)}
          placeholder="arroz, frango, banana…"
          aria-describedby="busca-ajuda"
          className="w-full rounded-lg border border-zinc-200 bg-white py-2.5 pl-9 pr-9 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:border-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
        />
        {busca.status === "searching" && (
          <Loader2
            aria-hidden="true"
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 motion-safe:animate-spin"
          />
        )}
      </div>
      <p id="busca-ajuda" className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
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
        <p className="mt-3 rounded-lg border border-red-200 p-3 text-sm text-red-700 dark:border-red-900/50 dark:text-red-400">
          {busca.error}
        </p>
      )}

      {busca.status === "ready" && busca.results.length > 0 && (
        <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto">
          {busca.results.map((f) => (
            <li key={f.food_ref}>
              <button
                type="button"
                onClick={() => onPick(f)}
                className="flex w-full items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-left hover:border-green-500/50 hover:bg-green-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 motion-safe:transition-colors dark:focus-visible:ring-offset-zinc-900"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                      {f.name}
                    </span>
                    <EstimateBadge isEstimate={f.is_estimate} compact />
                  </span>
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                    {formatDensity(f.kcal_per_base_unit, f.base_unit)}
                  </span>
                </span>
                <Plus aria-hidden="true" className="h-4 w-4 shrink-0 text-green-600 dark:text-green-500" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* § 6.1: `suggest_resolve` só vem true quando não houve resultado. É o
          gatilho do único caminho pago — e ele exige clique explícito. */}
      {busca.status === "ready" && busca.suggestResolve && (
        <div className="mt-3 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">
            Não achamos “{busca.term.trim()}” na tabela.
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Podemos estimar os valores com IA. O resultado fica marcado como estimativa e conta na
            sua cota do plano.
          </p>

          <fieldset className="mt-3">
            <legend className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Como você mede esse alimento?
            </legend>
            <div className="mt-1.5 flex gap-1.5">
              {(["g", "ml", "un"] as FoodBaseUnit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  aria-pressed={unidadeResolve === u}
                  onClick={() => setUnidadeResolve(u)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 motion-safe:transition-colors dark:focus-visible:ring-offset-zinc-900 ${
                    unidadeResolve === u
                      ? "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400"
                      : "border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
                  }`}
                >
                  {DIARY_UNIT_LABELS[u]}
                </button>
              ))}
            </div>
          </fieldset>

          {erroResolve && (
            <p className="mt-3 text-sm text-red-700 dark:text-red-400">{erroResolve}</p>
          )}

          <button
            type="button"
            onClick={estimar}
            disabled={busca.resolving}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:opacity-50 motion-safe:transition-colors dark:border-zinc-700 dark:text-zinc-200 dark:focus-visible:ring-offset-zinc-900"
          >
            {busca.resolving ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
            ) : (
              <Sparkles aria-hidden="true" className="h-4 w-4" />
            )}
            Estimar com IA
          </button>
        </div>
      )}

      {busca.status === "idle" && (
        <p className="mt-6 text-center text-sm text-zinc-400 dark:text-zinc-500">
          Digite o nome de um alimento para começar.
        </p>
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
  // Depende da unidade: `100` para g/ml, `1` para unidade de contagem. Fixo em "100",
  // escolher um alimento medido por unidade e adicionar sem tocar no campo gravava
  // 100 unidades sem nenhum aviso.
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
      <div className="rounded-lg border border-green-500/40 bg-green-500/5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-sm font-bold text-zinc-900 dark:text-white">{food.name}</p>
              <EstimateBadge isEstimate={food.is_estimate} />
            </div>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Vai para {slotLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Escolher outro alimento"
            className="shrink-0 rounded-md p-1 text-zinc-400 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:hover:text-zinc-200"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        {food.is_estimate && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            Estes valores são uma estimativa, não vieram de tabela oficial.
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <div className="w-28">
            <label
              htmlFor="porcao-quantidade"
              className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              Quantidade
            </label>
            <input
              id="porcao-quantidade"
              ref={quantidadeRef}
              type="text"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm tabular-nums text-zinc-900 focus-visible:border-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
            />
          </div>
          <div className="min-w-0 flex-1">
            <label
              htmlFor="porcao-unidade"
              className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
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
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus-visible:border-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
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
          <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-400">
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-green-500 px-4 py-2.5 text-sm font-semibold text-green-950 hover:bg-green-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:opacity-60 motion-safe:transition-colors dark:focus-visible:ring-offset-zinc-900"
        >
          {submitting ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
          ) : (
            <Plus aria-hidden="true" className="h-4 w-4" />
          )}
          Adicionar ao diário
        </button>
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
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: {
  day: DiaryDay;
  editando: DiaryEntry | null;
  mutating: boolean;
  onEdit: (e: DiaryEntry) => void;
  onCancelEdit: () => void;
  onSave: (entry: DiaryEntry, quantity: number, slot: MealSlot) => void;
  onDelete: (e: DiaryEntry) => void;
}) {
  if (day.entries_count === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">
          Nada registrado ainda neste dia.
        </p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
          Busque um alimento ao lado e ele aparece aqui, com as calorias somadas pelo servidor.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {day.slots
        .filter((s) => s.entries.length > 0)
        .map((s) => (
          <div key={s.slot}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                {s.label}
              </h3>
              <span className="text-xs font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">
                {formatKcal(s.logged_calories)} kcal
              </span>
            </div>

            <ul className="space-y-1">
              {s.entries.map((e) =>
                editando?.id === e.id ? (
                  <li key={e.id}>
                    <EntryEditForm
                      entry={e}
                      submitting={mutating}
                      onCancel={onCancelEdit}
                      onSave={onSave}
                    />
                  </li>
                ) : (
                  <li
                    key={e.id}
                    className="flex items-center gap-2 rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                          {e.food_name}
                        </span>
                        <EstimateBadge isEstimate={e.is_estimate} compact />
                      </div>
                      <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                        {formatQuantity(e.quantity)} {DIARY_UNIT_LABELS[e.unit]} ·{" "}
                        {formatKcal(e.calories_total)} kcal
                      </span>
                    </div>

                    {/* `disabled` durante a mutação: sem isto, dois cliques rápidos em
                        apagar disparam duas exclusões concorrentes. */}
                    <button
                      type="button"
                      onClick={() => onEdit(e)}
                      disabled={mutating}
                      aria-label={`Editar ${e.food_name}`}
                      className="rounded-md p-1.5 text-zinc-400 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:text-zinc-200 dark:focus-visible:ring-offset-zinc-900"
                    >
                      <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(e)}
                      disabled={mutating}
                      aria-label={`Apagar ${e.food_name}`}
                      className="rounded-md p-1.5 text-zinc-400 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:focus-visible:ring-offset-zinc-900"
                    >
                      <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}

      {day.has_estimate && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Este dia tem alimentos com valores estimados, marcados na lista.
        </p>
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
    <form
      onSubmit={submeter}
      className="rounded-lg border border-green-500/40 bg-green-500/5 p-3"
      aria-label={`Editando ${entry.food_name}`}
    >
      <p className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">{entry.food_name}</p>

      <div className="flex flex-wrap gap-2">
        <div className="w-24">
          <label
            htmlFor={`edit-qtd-${entry.id}`}
            className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Quantidade
          </label>
          <input
            id={`edit-qtd-${entry.id}`}
            type="text"
            inputMode="decimal"
            autoFocus
            value={quantity}
            onChange={(ev) => setQuantity(ev.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm tabular-nums text-zinc-900 focus-visible:border-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
          />
        </div>

        <div className="min-w-0 flex-1">
          <label
            htmlFor={`edit-slot-${entry.id}`}
            className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Refeição
          </label>
          <select
            id={`edit-slot-${entry.id}`}
            value={slot}
            onChange={(ev) => setSlot(ev.target.value as MealSlot)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus-visible:border-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
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
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Unidade: {DIARY_UNIT_LABELS[entry.unit]}. Para trocar a unidade, apague e registre de novo.
      </p>

      {erro && (
        <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-400">
          {erro}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-green-950 hover:bg-green-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:opacity-60 motion-safe:transition-colors dark:focus-visible:ring-offset-zinc-900"
        >
          Salvar
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 motion-safe:transition-colors dark:border-zinc-700 dark:text-zinc-200 dark:focus-visible:ring-offset-zinc-900"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
