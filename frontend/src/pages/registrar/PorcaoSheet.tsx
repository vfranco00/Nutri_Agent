import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Minus, Plus, ScanBarcode } from "lucide-react";
import { Sheet } from "../../components/ui/Sheet";
import { Button } from "../../components/ui/Button";
import { formatGrams, formatKcal, formatQuantity } from "../../lib/diary";
import { padraoDoMais, previa } from "../../lib/registro";
import { ROUTES } from "../../routes";
import { DIARY_UNIT_LABELS, type DiaryUnit, type FoodOption } from "../../types";

export interface PorcaoSheetProps {
  food: FoodOption | null;
  /** "Café · Hoje" */
  destino: string;
  onClose: () => void;
  onAdd: (food: FoodOption, quantity: number, unit: DiaryUnit) => void;
}

/** Folha de porção (protótipo `openPor`): passo ±0,5, atalhos, unidade, prévia e botão de código de barras. */
export function PorcaoSheet({ food, destino, onClose, onAdd }: PorcaoSheetProps) {
  return (
    <Sheet open={food !== null} onOpenChange={(o) => !o && onClose()} title={food?.name ?? "Porção"}>
      {food ? <Corpo key={food.food_ref} food={food} destino={destino} onAdd={onAdd} /> : null}
    </Sheet>
  );
}

/** Atalhos de quantidade na unidade base: 200/250/350 ml para bebida, 50-200 g para o resto. */
const ATALHOS_ML = [200, 250, 350];
const ATALHOS_G = [50, 100, 150, 200];

/** Líquido (ml) começa na lata/garrafa inteira; senão na porção do rótulo; senão 100. */
function quantidadeInicial(food: FoodOption, padrao: { quantity: number; unit: DiaryUnit }): number {
  if (padrao.unit !== food.base_unit) return padrao.quantity;
  const porcoes = food.portions ?? [];
  return porcoes[porcoes.length - 1]?.quantity ?? padrao.quantity;
}

function textoDosValores(food: FoodOption): string {
  if (food.portion_label) return `Valores por ${food.portion_label}`;
  if (food.base_unit === "g" || food.base_unit === "ml") return `Valores por 100 ${food.base_unit}`;
  return "Valores do catálogo";
}

function Corpo({ food, destino, onAdd }: { food: FoodOption; destino: string; onAdd: PorcaoSheetProps["onAdd"] }) {
  const location = useLocation();
  const padrao = padraoDoMais(food);
  const [quantity, setQuantity] = useState(quantidadeInicial(food, padrao));
  const [unit, setUnit] = useState<DiaryUnit>(padrao.unit);
  const massa = unit === "g" || unit === "ml";
  const passo = massa ? 10 : 0.5;
  const minimo = massa ? 1 : 0.5;
  const porcoes = unit === food.base_unit ? (food.portions ?? []) : [];
  const genericos = unit === "ml" ? ATALHOS_ML : ATALHOS_G;
  const atalhos: { valor: number; rotulo: string }[] = massa
    ? [
        ...porcoes.map((p) => ({ valor: p.quantity, rotulo: `${p.label} ${formatQuantity(p.quantity)} ${unit}` })),
        ...genericos
          .filter((v) => !porcoes.some((p) => p.quantity === v))
          .map((v) => ({ valor: v, rotulo: `${formatQuantity(v)} ${unit}` })),
      ]
    : [0.5, 1, 1.5, 2].map((v) => ({ valor: v, rotulo: `${formatQuantity(v)} ×` }));
  const p = previa(food, quantity, unit);

  function trocarUnidade(u: DiaryUnit) {
    setUnit(u);
    setQuantity(u === "g" || u === "ml" ? 100 : 1);
  }

  return (
    <div className="space-y-4 pb-2">
      <div className="flex flex-wrap items-center gap-2 text-sm text-mut">
        <span>{textoDosValores(food)}</span>
        {food.is_estimate ? <span className="rounded-full bg-soft px-2 py-0.5 text-xs font-bold">estimativa</span> : null}
        <Link
          to={ROUTES.codigoDeBarras}
          state={{ background: (location.state as { background?: unknown } | null)?.background ?? location }}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-soft px-3 py-2 text-xs font-extrabold text-ink"
        >
          <ScanBarcode className="h-4 w-4" aria-hidden="true" />
          Código de barras
        </Link>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-1 items-center justify-between rounded-2xl bg-soft px-2 py-1.5">
          <button type="button" aria-label="Diminuir" onClick={() => setQuantity((q) => Math.max(minimo, +(q - passo).toFixed(2)))} className="flex h-10 w-10 items-center justify-center rounded-xl active:scale-[.97]">
            <Minus className="h-5 w-5" aria-hidden="true" />
          </button>
          <b aria-label="Quantidade" className="text-xl">{formatQuantity(quantity)}</b>
          <button type="button" aria-label="Aumentar" onClick={() => setQuantity((q) => +(q + passo).toFixed(2))} className="flex h-10 w-10 items-center justify-center rounded-xl active:scale-[.97]">
            <Plus className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <select
          aria-label="Unidade"
          value={unit}
          onChange={(e) => trocarUnidade(e.target.value as DiaryUnit)}
          className="rounded-2xl bg-soft px-3 text-sm font-extrabold text-ink"
        >
          {food.allowed_units.map((u) => (
            <option key={u} value={u}>{u === "porcao" && food.portion_label ? food.portion_label : DIARY_UNIT_LABELS[u]}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {atalhos.map(({ valor, rotulo }) => (
          <button key={rotulo} type="button" onClick={() => setQuantity(valor)} className={`rounded-xl px-3.5 py-2 text-sm font-bold ${quantity === valor ? "bg-act-soft text-ink" : "text-mut"}`}>
            {rotulo}
          </button>
        ))}
      </div>

      <div className="text-center">
        <span className="text-5xl font-black tracking-tight">{formatKcal(p.kcal)}</span>{" "}
        <span className="font-bold text-mut">kcal</span>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center text-xs text-mut">
        {([["Proteína", p.p], ["Carbo", p.c], ["Gordura", p.g]] as const).map(([n, v]) => (
          <div key={n} className="rounded-2xl bg-soft py-2">
            <dd className="text-base font-extrabold text-ink">{formatGrams(v)}</dd>
            <dt>{n}</dt>
          </div>
        ))}
      </dl>

      <p className="text-sm text-mut">
        Vai para: <b className="text-ink">{destino}</b>
      </p>
      <Button className="w-full" onClick={() => onAdd(food, quantity, unit)}>
        Adicionar
      </Button>
    </div>
  );
}
