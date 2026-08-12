import { AlertTriangle } from "lucide-react";
import { buildMacroDonut, describeMacroDonut, formatGrams, formatKcal } from "../../lib/diary";
import type { MacroKey } from "../../lib/diary";
import type { DiaryDay } from "../../types";

interface MacroDonutProps {
  day: DiaryDay;
}

const ARC_CLASS: Record<MacroKey, string> = {
  protein: "stroke-green-500",
  carbs: "stroke-blue-600 dark:stroke-blue-400",
  fat: "stroke-amber-600 dark:stroke-amber-400",
};

const SWATCH_CLASS: Record<MacroKey, string> = {
  protein: "bg-green-500",
  carbs: "bg-blue-600 dark:bg-blue-400",
  fat: "bg-amber-600 dark:bg-amber-400",
};

/**
 * "Macros de hoje" — card trazido da Opção 2 para o dashboard da Opção 1.
 *
 * A legenda é a fonte da verdade e lista sempre os três macros, inclusive os
 * desconhecidos (`—`, nunca `0 g` — § 9.4). O donut desenha só a proporção do
 * que é conhecido, e a proporção é **em gramas**: converter macro em caloria
 * exigiria aplicar 4/4/9 no cliente, que é aritmética nutricional que o
 * backend não fez.
 */
export function MacroDonut({ day }: MacroDonutProps) {
  const totals = day.totals;
  const { slices, isEmpty } = buildMacroDonut(totals);

  const linhas: { key: MacroKey; label: string; grams: number | null }[] = [
    { key: "protein", label: "Proteína", grams: totals.protein_g },
    { key: "carbs", label: "Carboidrato", grams: totals.carbs_g },
    { key: "fat", label: "Gordura", grams: totals.fat_g },
  ];

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">Macros de hoje</h3>

      {isEmpty ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Nenhum macronutriente informado ainda. Eles aparecem conforme você registra alimentos.
        </p>
      ) : (
        <div className="flex items-center gap-5">
          <svg
            viewBox="0 0 100 100"
            role="img"
            aria-label={describeMacroDonut(totals, day.macros_incomplete)}
            className="h-[104px] w-[104px] shrink-0"
          >
            <g transform="rotate(-90 50 50)" fill="none" strokeWidth="13">
              <circle
                cx="50"
                cy="50"
                r="40"
                pathLength={100}
                className="stroke-zinc-200 dark:stroke-zinc-800"
              />
              {slices.map((s) => (
                <circle
                  key={s.key}
                  cx="50"
                  cy="50"
                  r="40"
                  pathLength={100}
                  strokeDasharray={`${s.percent} ${100 - s.percent}`}
                  strokeDashoffset={s.offset}
                  className={ARC_CLASS[s.key]}
                />
              ))}
            </g>
            <text
              x="50"
              y="47"
              textAnchor="middle"
              className="fill-zinc-900 text-[17px] font-bold dark:fill-white"
            >
              {formatKcal(totals.calories)}
            </text>
            <text
              x="50"
              y="60"
              textAnchor="middle"
              className="fill-zinc-400 text-[8.5px] tracking-widest dark:fill-zinc-500"
            >
              KCAL
            </text>
          </svg>

          <dl className="min-w-0 flex-1 space-y-2.5">
            {linhas.map((l) => (
              <div key={l.key} className="flex items-center gap-2.5 text-sm">
                <i aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-sm ${SWATCH_CLASS[l.key]}`} />
                <dt className="text-zinc-600 dark:text-zinc-400">{l.label}</dt>
                <dd className="ml-auto font-semibold tabular-nums text-zinc-900 dark:text-white">
                  {formatGrams(l.grams)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {day.macros_incomplete && (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
          <AlertTriangle aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
          Alguns alimentos do dia não informam macros. A proporção acima é parcial.
        </p>
      )}
    </div>
  );
}
