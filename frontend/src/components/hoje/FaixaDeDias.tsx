import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { fromIsoDate } from "../../lib/diary";
import { diasDaFaixa } from "../../lib/faixaDias";
import type { DiarySummaryResponse } from "../../types";

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/**
 * Faixa de dias do Hoje. Os pontos verdes marcam os dias com algo registrado (uma única
 * chamada a `/diary/summary`; se falhar, a faixa segue sem os pontos).
 */
export function FaixaDeDias({ date, onSelect }: { date: string; onSelect: (iso: string) => void }) {
  const dias = diasDaFaixa(date);
  const [registrados, setRegistrados] = useState<Set<string>>(new Set());

  useEffect(() => {
    let ativo = true;
    api
      .get<DiarySummaryResponse>("/diary/summary", { params: { start: dias[0], end: dias[dias.length - 1] } })
      .then((res) => {
        if (!ativo) return;
        const lista = Array.isArray(res?.data?.days) ? res.data.days : [];
        setRegistrados(new Set(lista.filter((d) => d.entries_count > 0).map((d) => d.date)));
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dias[0]]);

  return (
    <div className="flex gap-1.5 py-2" role="group" aria-label="Dias">
      {dias.map((iso) => {
        const d = fromIsoDate(iso);
        const ativo = iso === date;
        return (
          <button
            key={iso}
            type="button"
            aria-pressed={ativo}
            aria-label={`${SEMANA[d.getDay()]} ${d.getDate()}`}
            onClick={() => onSelect(iso)}
            className={`flex-1 rounded-[14px] py-[7px] text-[11px] font-bold ${
              ativo ? "bg-act text-on-act" : "bg-card text-mut"
            }`}
          >
            {SEMANA[d.getDay()]}
            <b className={`block text-[15px] font-extrabold ${ativo ? "text-on-act" : "text-ink"}`}>{d.getDate()}</b>
            {registrados.has(iso) ? (
              <span className={`mx-auto mt-0.5 block h-[5px] w-[5px] rounded-full ${ativo ? "bg-on-act" : "bg-pos"}`} />
            ) : (
              <span className="mx-auto mt-0.5 block h-[5px] w-[5px]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
