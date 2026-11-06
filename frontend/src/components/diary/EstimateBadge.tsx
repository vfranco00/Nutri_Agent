import { Sparkles } from "lucide-react";

interface EstimateBadgeProps {
  /** `FoodOption.is_estimate` / `DiaryEntry.is_estimate`, já calculado no servidor. */
  isEstimate: boolean;
  /** `compact` cabe dentro de uma linha de lista; o padrão vai em bloco. */
  compact?: boolean;
}

/**
 * Marca visível de que o valor nutricional é ESTIMADO — origem `llm` ou
 * `openfoodfacts` (RS-17 / ADR-0002 § 8). Requisito de segurança, não enfeite: o rótulo é
 * textual (`Estimativa`), e não só uma cor ou um ícone.
 */
export function EstimateBadge({ isEstimate, compact = false }: EstimateBadgeProps) {
  if (!isEstimate) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md bg-act-soft font-black tracking-wide text-act-text ${
        compact ? "px-1.5 py-0 text-[9.5px]" : "px-2 py-0.5 text-xs"
      }`}
      title="Valor nutricional estimado, não verificado por tabela oficial."
    >
      <Sparkles aria-hidden="true" className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
      Estimativa
    </span>
  );
}
