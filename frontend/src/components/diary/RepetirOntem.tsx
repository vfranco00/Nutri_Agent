import { useEffect, useState } from "react";
import { Repeat } from "lucide-react";
import { api } from "../../lib/api";
import { formatKcal, shiftIsoDate, toIsoDate } from "../../lib/diary";
import { copiarDia, mensagemDeErro, NOME_DA_REFEICAO, SLOT_DA_REFEICAO } from "../../lib/registro";
import { toast } from "../ui/toastStore";
import type { Refeicao } from "../../routes";
import type { DiaryDay } from "../../types";

interface RepetirOntemProps {
  refeicao: Refeicao;
  /** Dia de destino ('YYYY-MM-DD'); o padrão é hoje. A origem é sempre o dia anterior. */
  data?: string;
  /** Chamado depois de repetir (a folha fecha, por exemplo). */
  onDone?: () => void;
}

/**
 * Cartão "Repetir café de ontem" (protótipo `renderReg` / `repeatYesterday`). Só aparece se
 * ontem tem alguma coisa nessa refeição. Os números são os que o servidor devolveu.
 */
export function RepetirOntem({ refeicao, data, onDone }: RepetirOntemProps) {
  const destino = data ?? toIsoDate(new Date());
  const origem = shiftIsoDate(destino, -1);
  const slot = SLOT_DA_REFEICAO[refeicao];
  const [ontem, setOntem] = useState<DiaryDay | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let ativo = true;
    setOntem(null);
    api
      .get<DiaryDay>("/diary", { params: { date: origem } })
      .then((r) => ativo && setOntem(r.data))
      .catch(() => ativo && setOntem(null));
    return () => {
      ativo = false;
    };
  }, [origem]);

  const entradas = ontem?.slots.find((s) => s.slot === slot)?.entries ?? [];
  if (entradas.length === 0) return null;
  const kcal = ontem?.slots.find((s) => s.slot === slot)?.logged_calories ?? 0;
  const nomes = entradas.slice(0, 3).map((e) => e.food_name.toLowerCase()).join(", ");
  const nome = NOME_DA_REFEICAO[refeicao].toLowerCase();

  async function repetir() {
    setEnviando(true);
    try {
      await copiarDia({ from_date: origem, to_date: destino, meal_slot: slot });
      toast(`${NOME_DA_REFEICAO[refeicao]} repetido de ontem`);
      onDone?.();
    } catch (err) {
      toast(mensagemDeErro(err, "Não foi possível repetir agora."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <button
      type="button"
      onClick={repetir}
      disabled={enviando}
      className="flex w-full items-center gap-3 rounded-2xl bg-bar p-4 text-left text-bar-on active:scale-[.97] disabled:opacity-60"
    >
      <Repeat className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <b className="block text-sm">Repetir {nome} de ontem</b>
        <span className="block truncate text-xs opacity-70">
          {nomes} · {formatKcal(kcal)} kcal
        </span>
      </span>
      <span className="rounded-xl bg-act px-3 py-1.5 text-xs font-extrabold text-nuvi-tinta">Repetir</span>
    </button>
  );
}
