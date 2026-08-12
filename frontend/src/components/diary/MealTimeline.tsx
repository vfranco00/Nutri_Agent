import { Plus } from "lucide-react";
import { formatKcal, formatQuantity } from "../../lib/diary";
import { DIARY_UNIT_LABELS, type DiaryDay, type DiaryDaySlot, type MealSlot } from "../../types";
import { EstimateBadge } from "./EstimateBadge";

interface MealTimelineProps {
  day: DiaryDay;
  onAddToSlot: (slot: MealSlot) => void;
}

/**
 * Linha do tempo das refeições do dia (herói da Opção 1).
 *
 * O mockup traz uma coluna de horário ("07:30", "12:30"); a API não guarda
 * horário de refeição, então a âncora aqui é o **slot**, que já carrega a ordem
 * do dia. Inventar um relógio seria mostrar dado que ninguém registrou.
 *
 * Os 6 slots vêm sempre presentes e sempre na ordem canônica (§ 6.0) — este
 * componente não cria, não ordena e não preenche buraco.
 */
export function MealTimeline({ day, onAddToSlot }: MealTimelineProps) {
  return (
    <ol className="space-y-0">
      {day.slots.map((slot, i) => (
        <SlotRow
          key={slot.slot}
          slot={slot}
          isLast={i === day.slots.length - 1}
          onAdd={() => onAddToSlot(slot.slot)}
        />
      ))}
    </ol>
  );
}

function SlotRow({
  slot,
  isLast,
  onAdd,
}: {
  slot: DiaryDaySlot;
  isLast: boolean;
  onAdd: () => void;
}) {
  const temRegistro = slot.entries.length > 0;
  const temPlano = slot.planned_meals.length > 0;

  return (
    <li className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-start gap-x-3 border-t border-dashed border-zinc-200 py-3.5 first:border-t-0 dark:border-zinc-800">
      {/* Coluna do marcador: cheio = registrado, vazado = só planejado. */}
      <span aria-hidden="true" className="relative flex h-full justify-center pt-1.5">
        {!isLast && <i className="absolute top-3 bottom-[-1.25rem] w-px bg-zinc-200 dark:bg-zinc-800" />}
        <i
          className={`relative z-10 h-2.5 w-2.5 rounded-full border-2 ${
            temRegistro
              ? "border-green-500 bg-green-500"
              : temPlano
                ? "border-zinc-400 bg-white dark:border-zinc-600 dark:bg-zinc-900"
                : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
          }`}
        />
      </span>

      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          {slot.label}
        </p>

        {temRegistro && (
          <ul className="mt-1 space-y-1">
            {slot.entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                  {e.food_name}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {formatQuantity(e.quantity)} {DIARY_UNIT_LABELS[e.unit]}
                </span>
                <EstimateBadge isEstimate={e.is_estimate} compact />
                <span className="ml-auto shrink-0 text-xs font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
                  {formatKcal(e.calories_total)} kcal
                </span>
              </li>
            ))}
          </ul>
        )}

        {temPlano && (
          <ul className="mt-1 space-y-0.5">
            {slot.planned_meals.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-2 text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">{m.title}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  planejado
                </span>
                {m.calories !== null && (
                  <span className="ml-auto shrink-0 text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
                    {formatKcal(m.calories)} kcal
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {!temRegistro && !temPlano && (
          <button
            type="button"
            onClick={onAdd}
            className="mt-1 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-zinc-400 hover:text-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 motion-safe:transition-colors dark:text-zinc-500 dark:hover:text-green-400 dark:focus-visible:ring-offset-zinc-900"
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            Registrar {slot.label.toLowerCase()}
          </button>
        )}
      </div>

      <div className="shrink-0 text-right">
        {temRegistro ? (
          <p className="text-sm font-bold tabular-nums text-zinc-900 dark:text-white">
            {formatKcal(slot.logged_calories)}
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              kcal
            </span>
          </p>
        ) : (
          temPlano && (
            <p className="text-sm font-bold tabular-nums text-zinc-400 dark:text-zinc-500">
              {formatKcal(slot.planned_calories)}
              <span className="block text-[10px] font-semibold uppercase tracking-wide">
                planejado
              </span>
            </p>
          )
        )}
      </div>
    </li>
  );
}
