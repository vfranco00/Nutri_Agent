import { AlertTriangle } from "lucide-react";
import { buildMacroDonut, describeMacroDonut, formatGrams } from "../../lib/diary";
import type { MacroKey } from "../../lib/diary";
import type { DiaryDay } from "../../types";

const COR: Record<MacroKey, string> = {
  protein: "bg-ink",
  carbs: "bg-act",
  fat: "bg-nuvi-gomo",
};

/**
 * "Macros de hoje": três caixas do protótipo (`.mac`). O valor é literal da API; macro
 * desconhecido é `—`, nunca `0 g` (§ 9.4). A barrinha mostra a proporção EM GRAMAS entre os
 * macros conhecidos (sem aplicar 4/4/9 no cliente). Os números trocam sem animação.
 */
export function MacroBarras({ day }: { day: DiaryDay }) {
  const totals = day.totals;
  const { slices } = buildMacroDonut(totals);
  const pct = (k: MacroKey) => slices.find((s) => s.key === k)?.percent ?? 0;
  const linhas: { key: MacroKey; label: string; grams: number | null }[] = [
    { key: "protein", label: "Proteína", grams: totals.protein_g },
    { key: "carbs", label: "Carbo", grams: totals.carbs_g },
    { key: "fat", label: "Gordura", grams: totals.fat_g },
  ];

  return (
    <div role="group" aria-label={describeMacroDonut(totals, day.macros_incomplete)}>
      <h3 className="mb-1.5 mt-2 text-[11px] font-bold uppercase tracking-wider text-mut" aria-hidden="true">
        Macros de hoje
      </h3>
      <div className="flex gap-2">
        {linhas.map((l) => (
          <div key={l.key} className="flex-1 rounded-2xl bg-soft px-2 py-2.5 text-center text-[11.5px] text-mut">
            <b className="block text-[14.5px] text-ink">{formatGrams(l.grams)}</b>
            {l.label}
            <i className="mt-1.5 block h-[5px] overflow-hidden rounded-[3px] bg-ink/10">
              <em className={`block h-full rounded-[3px] ${COR[l.key]}`} style={{ width: `${pct(l.key)}%` }} />
            </i>
          </div>
        ))}
      </div>
      {day.macros_incomplete && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-act-soft p-2.5 text-xs text-act-text">
          <AlertTriangle aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
          Alguns alimentos do dia não informam macros. A proporção acima é parcial.
        </p>
      )}
    </div>
  );
}
