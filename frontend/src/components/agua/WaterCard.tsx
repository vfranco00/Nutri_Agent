import { useState } from "react";
import { Droplet } from "lucide-react";
import { Button } from "../ui/Button";
import { toast } from "../ui/toastStore";
import { WaterSheet } from "./WaterSheet";
import { useWater } from "./useWater";

/** Cartão de água do Hoje: total/meta, barra verde sólida, +250 ml e outra quantidade. */
export function WaterCard({ date }: { date?: string }) {
  const { dia, erro, adicionar, desfazer } = useWater(date);
  const [aberto, setAberto] = useState(false);

  async function somar(ml: number) {
    setAberto(false);
    try {
      const id = await adicionar(ml);
      toast(`+${ml} ml de água`, {
        action: id === null ? undefined : { label: "Desfazer", onClick: () => void desfazer(id).catch(() => toast("Não deu para desfazer.")) },
      });
    } catch {
      toast("Não deu para registrar a água. Tente de novo.");
    }
  }

  if (erro) return null;
  const total = dia?.total_ml ?? 0;
  const meta = dia?.goal_ml ?? 0;
  const pct = meta > 0 ? Math.min(100, Math.round((total / meta) * 100)) : 0;

  return (
    <section aria-label="Água" className="rounded-3xl bg-card p-4 text-ink">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-[15px] font-extrabold">
          <Droplet className="h-4 w-4 text-pos-text" aria-hidden="true" />
          Água
        </h3>
        <span className="text-sm font-bold">
          {dia ? `${total} de ${meta} ml` : "—"}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Água do dia"
        aria-valuemin={0}
        aria-valuemax={meta || 100}
        aria-valuenow={total}
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-soft"
      >
        <div className="h-full rounded-full bg-pos" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-3 flex gap-2">
        <Button className="flex-1 py-2.5" disabled={!dia} onClick={() => void somar(250)}>
          +250 ml
        </Button>
        <Button variant="outline" className="flex-1 py-2.5" disabled={!dia} onClick={() => setAberto(true)}>
          Outra quantidade
        </Button>
      </div>
      <WaterSheet open={aberto} onOpenChange={setAberto} onAdd={(ml) => void somar(ml)} />
    </section>
  );
}
