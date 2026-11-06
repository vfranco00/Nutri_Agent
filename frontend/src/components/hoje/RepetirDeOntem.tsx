import { useEffect, useState } from "react";
import { Repeat } from "lucide-react";
import { api } from "../../lib/api";
import { shiftIsoDate } from "../../lib/diary";
import { copiarDia, mensagemDeErro } from "../../lib/registro";
import { toast } from "../ui/toastStore";
import type { DiaryDay, MealSlot } from "../../types";

export interface RepetirSlotProps {
  date: string;
  slot: MealSlot;
}

// Uma leitura de "ontem" serve às 6 linhas do Hoje: guarda a promessa por data por alguns segundos.
const CACHE_MS = 15_000;
const ontemCache = new Map<string, { em: number; promessa: Promise<DiaryDay> }>();
function lerDia(iso: string): Promise<DiaryDay> {
  const c = ontemCache.get(iso);
  if (c && Date.now() - c.em < CACHE_MS) return c.promessa;
  const promessa = api.get<DiaryDay>("/diary", { params: { date: iso } }).then((r) => r.data);
  ontemCache.set(iso, { em: Date.now(), promessa });
  promessa.catch(() => ontemCache.delete(iso));
  return promessa;
}

/** Botão "Repetir" de uma refeição vazia: copia a mesma refeição de ontem. Some se ontem não tinha nada. */
export function RepetirDeOntem({ date, slot }: RepetirSlotProps) {
  const origem = shiftIsoDate(date, -1);
  const [tem, setTem] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let ativo = true;
    setTem(false);
    lerDia(origem)
      .then((d) => ativo && setTem((d.slots.find((s) => s.slot === slot)?.entries.length ?? 0) > 0))
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [origem, slot]);

  if (!tem) return null;

  async function repetir(e: React.MouseEvent) {
    e.stopPropagation();
    setEnviando(true);
    try {
      await copiarDia({ from_date: origem, to_date: date, meal_slot: slot });
      ontemCache.clear();
      toast("Refeição repetida de ontem");
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
      aria-label="Repetir de ontem"
      className="flex h-[34px] flex-none items-center gap-1 rounded-xl bg-soft px-2.5 text-xs font-extrabold text-ink active:scale-[.97] disabled:opacity-50"
    >
      <Repeat className="h-4 w-4" aria-hidden="true" />
      Ontem
    </button>
  );
}

