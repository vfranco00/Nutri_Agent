import { buildEnergyBar, describeEnergyBar, formatKcal, segmentWidth } from "../../lib/diary";
import type { DiaryDay } from "../../types";

interface EnergyBarProps {
  day: DiaryDay;
}

/**
 * Barra de energia segmentada por refeição (assinatura da Opção 1).
 *
 * Bloco sólido = registrado. Bloco hachurado = planejado que ainda não foi
 * registrado. A largura é proporcional às calorias; os números escritos dentro
 * dos blocos saem literais da API (§ 9.3, regra 4).
 */
export function EnergyBar({ day }: EnergyBarProps) {
  const { segments, scale, isEmpty } = buildEnergyBar(day);

  if (isEmpty) return null;

  return (
    <div className="space-y-3">
      {/* role="img" + aria-label: a barra inteira é lida como uma frase só,
          em vez de virar 12 divs sem sentido no leitor de tela. */}
      <div
        role="img"
        aria-label={describeEnergyBar(day)}
        className="flex h-11 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800/60"
      >
        {segments.map((seg, i) => {
          const percent = (seg.weight / scale) * 100;
          const mostraNumero = seg.displayKcal !== null && percent >= 7;
          const legenda =
            seg.kind === "logged"
              ? `${seg.label}: ${formatKcal(seg.weight)} kcal registradas`
              : `${seg.label}: planejado ainda não registrado`;

          return (
            <div
              key={`${seg.slot}-${seg.kind}-${i}`}
              title={legenda}
              style={{ width: segmentWidth(seg.weight, scale) }}
              className={`flex h-full items-center justify-center border-r border-white/70 last:border-r-0 dark:border-zinc-900/70 ${
                seg.kind === "logged" ? "bg-green-500" : "diary-hatch"
              }`}
            >
              {mostraNumero && (
                <span
                  aria-hidden="true"
                  className={`text-[10px] font-bold tabular-nums ${
                    seg.kind === "logged" ? "text-green-950" : "text-green-700 dark:text-green-300"
                  }`}
                >
                  {formatKcal(seg.displayKcal as number)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <i aria-hidden="true" className="block h-3 w-3 rounded-sm bg-green-500" />
          Registrado · {formatKcal(day.totals.calories)} kcal
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i
            aria-hidden="true"
            className="diary-hatch block h-3 w-3 rounded-sm border border-green-500/40"
          />
          Planejado · {formatKcal(day.planned_totals.calories)} kcal
        </span>
        <span className="text-zinc-400 dark:text-zinc-500">
          Cada bloco é uma refeição, na proporção das calorias.
        </span>
      </div>

      {day.planned_unmatched_calories > 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {formatKcal(day.planned_unmatched_calories)} kcal do cardápio estão em refeições fora dos
          seis horários padrão — entram no total planejado, mas não em nenhum bloco.
        </p>
      )}
    </div>
  );
}
