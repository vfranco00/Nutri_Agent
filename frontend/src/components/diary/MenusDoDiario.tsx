import { useState, type ReactNode } from "react";
import { CalendarDays, CalendarPlus, Copy, Share2, Star, Trash2 } from "lucide-react";
import { Sheet } from "../ui/Sheet";
import { Dialog } from "../ui/Dialog";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { toast } from "../ui/toastStore";
import { formatKcal, formatDiaryDate, shiftIsoDate } from "../../lib/diary";
import { apagarEntrada, copiarDia, mensagemDeErro, recriarEntrada, salvarRefeicaoPronta } from "../../lib/registro";
import type { DiaryDay, DiaryEntry, MealSlot } from "../../types";

function Item({ icon, children, onClick, perigo }: { icon: ReactNode; children: ReactNode; onClick: () => void; perigo?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left text-sm font-bold active:scale-[.97] ${perigo ? "text-red-600" : "text-ink"}`}>
      <span className={perigo ? "text-red-600" : "text-act-text"} aria-hidden="true">{icon}</span>
      {children}
    </button>
  );
}

/** Pede um dia ('YYYY-MM-DD'); devolve pelo `onEscolher`. */
function EscolherDia({ aberto, titulo, inicial, onFechar, onEscolher }: { aberto: boolean; titulo: string; inicial: string; onFechar: () => void; onEscolher: (iso: string) => void }) {
  const [valor, setValor] = useState(inicial);
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()} title={titulo}>
      <label className="mt-4 block text-sm font-bold">
        Dia
        <Input type="date" value={valor} onChange={(e) => setValor(e.target.value)} className="mt-1" />
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
        <Button disabled={!valor} onClick={() => onEscolher(valor)}>Escolher</Button>
      </div>
    </Dialog>
  );
}

async function comAviso(fn: () => Promise<unknown>, ok: string, falha: string) {
  try {
    await fn();
    toast(ok);
  } catch (err) {
    toast(mensagemDeErro(err, falha));
  }
}

// ---------------------------------------------------------------------------

export interface MenuRefeicaoProps {
  aberto: boolean;
  onFechar: () => void;
  nome: string;
  slot: MealSlot;
  /** Dia da refeição ('YYYY-MM-DD'). */
  data: string;
  entradas: DiaryEntry[];
}

/** Menu da refeição (protótipo `openMealMenu`): copiar, salvar como pronta e apagar com desfazer. */
export function MenuRefeicao({ aberto, onFechar, nome, slot, data, entradas }: MenuRefeicaoProps) {
  const [dialogo, setDialogo] = useState<"outro-dia" | "salvar" | null>(null);
  const [titulo, setTitulo] = useState(nome);

  const copiar = (para: string) =>
    comAviso(() => copiarDia({ from_date: data, to_date: para, meal_slot: slot }), "Refeição copiada", "Não foi possível copiar agora.");

  async function apagar() {
    const copia = [...entradas];
    try {
      for (const e of copia) await apagarEntrada(e.id);
    } catch (err) {
      toast(mensagemDeErro(err, "Não foi possível apagar a refeição."));
      return;
    }
    toast("Refeição apagada", {
      action: {
        label: "Desfazer",
        onClick: async () => {
          try {
            for (const e of copia) await recriarEntrada(e);
          } catch (err) {
            toast(mensagemDeErro(err, "Não foi possível desfazer."));
          }
        },
      },
    });
  }

  return (
    <>
      <Sheet open={aberto && dialogo === null} onOpenChange={(o) => !o && onFechar()} title={nome}>
        <div className="-mt-1">
          <Item icon={<CalendarPlus className="h-5 w-5" />} onClick={() => { onFechar(); void copiar(shiftIsoDate(data, 1)); }}>Copiar para amanhã</Item>
          <Item icon={<CalendarDays className="h-5 w-5" />} onClick={() => setDialogo("outro-dia")}>Copiar para outro dia…</Item>
          <Item icon={<Star className="h-5 w-5" />} onClick={() => setDialogo("salvar")}>Salvar como refeição pronta</Item>
          <Item perigo icon={<Trash2 className="h-5 w-5" />} onClick={() => { onFechar(); void apagar(); }}>Apagar refeição</Item>
        </div>
      </Sheet>

      <EscolherDia
        aberto={dialogo === "outro-dia"}
        titulo="Copiar para outro dia"
        inicial={shiftIsoDate(data, 1)}
        onFechar={() => setDialogo(null)}
        onEscolher={(iso) => { setDialogo(null); onFechar(); void copiar(iso); }}
      />

      <Dialog open={dialogo === "salvar"} onOpenChange={(o) => !o && setDialogo(null)} title="Salvar como refeição pronta">
        <label className="mt-4 block text-sm font-bold">
          Nome
          <Input value={titulo} maxLength={80} onChange={(e) => setTitulo(e.target.value)} className="mt-1" />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDialogo(null)}>Cancelar</Button>
          <Button
            disabled={titulo.trim().length === 0}
            onClick={() => {
              setDialogo(null);
              onFechar();
              void comAviso(() => salvarRefeicaoPronta({ name: titulo.trim(), entry_date: data, meal_slot: slot }), "Refeição pronta salva", "Não foi possível salvar a refeição.");
            }}
          >
            Salvar
          </Button>
        </div>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------

export interface MenuDiaProps {
  aberto: boolean;
  onFechar: () => void;
  data: string;
  day: DiaryDay | null;
}

/** Menu do dia inteiro (protótipo `openDayMenu`): copiar para amanhã, copiar de outro dia e compartilhar. */
export function MenuDia({ aberto, onFechar, data, day }: MenuDiaProps) {
  const [escolhendo, setEscolhendo] = useState(false);

  async function compartilhar() {
    if (!day) return;
    // Texto montado só com números que o servidor devolveu.
    const texto = `Nuvi · ${formatDiaryDate(day.date)}: ${formatKcal(day.totals.calories)} kcal em ${day.entries_count} ${day.entries_count === 1 ? "registro" : "registros"}.`;
    try {
      if (navigator.share) await navigator.share({ text: texto });
      else {
        await navigator.clipboard.writeText(texto);
        toast("Resumo copiado");
      }
    } catch {
      /* o usuário cancelou o compartilhamento */
    }
  }

  return (
    <>
      <Sheet open={aberto && !escolhendo} onOpenChange={(o) => !o && onFechar()} title="Dia inteiro">
        <div className="-mt-1">
          <Item icon={<Copy className="h-5 w-5" />} onClick={() => { onFechar(); void comAviso(() => copiarDia({ from_date: data, to_date: shiftIsoDate(data, 1) }), "Dia copiado para amanhã", "Não foi possível copiar agora."); }}>
            Copiar este dia para amanhã
          </Item>
          <Item icon={<CalendarDays className="h-5 w-5" />} onClick={() => setEscolhendo(true)}>Copiar de outro dia…</Item>
          <Item icon={<Share2 className="h-5 w-5" />} onClick={() => { onFechar(); void compartilhar(); }}>Compartilhar resumo</Item>
        </div>
      </Sheet>
      <EscolherDia
        aberto={escolhendo}
        titulo="Copiar de outro dia"
        inicial={shiftIsoDate(data, -1)}
        onFechar={() => setEscolhendo(false)}
        onEscolher={(iso) => { setEscolhendo(false); onFechar(); void comAviso(() => copiarDia({ from_date: iso, to_date: data }), "Dia copiado", "Não foi possível copiar agora."); }}
      />
    </>
  );
}
