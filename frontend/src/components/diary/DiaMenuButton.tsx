import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { MenuDia } from "./MenusDoDiario";
import type { DiaryDay } from "../../types";

/** Botão "⋯" do dia inteiro, com o `MenuDia` (copiar, copiar de outro dia, compartilhar). */
export function DiaMenuButton({ data, day }: { data: string; day: DiaryDay | null }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} aria-label="Menu do dia" className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-card text-ink">
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>
      <MenuDia aberto={aberto} onFechar={() => setAberto(false)} data={data} day={day} />
    </>
  );
}
