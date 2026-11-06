import { useEffect, useRef, useState } from "react";
import { formatKcal } from "../../lib/diary";
import { movimentoReduzido } from "../../lib/useReducedMotion";

const DURACAO = 450;
const suaviza = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Conta de um valor ao outro em 450 ms (rAF); com movimento reduzido, troca na hora. */
function useContagem(alvo: number): number {
  const [valor, setValor] = useState(alvo);
  const visto = useRef(alvo);
  const reduzido = movimentoReduzido() || typeof requestAnimationFrame !== "function";
  useEffect(() => {
    visto.current = valor;
  });
  useEffect(() => {
    if (reduzido) return;
    const de = visto.current;
    if (de === alvo) return;
    const t0 = performance.now();
    let id = 0;
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - t0) / DURACAO);
      setValor(de + (alvo - de) * suaviza(t));
      if (t < 1) id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [alvo, reduzido]);
  return reduzido ? alvo : valor;
}

export interface MedidorProps {
  /** kcal registradas no dia. */
  consumidas: number;
  /** Meta do perfil. */
  meta: number;
}

/**
 * Medidor de meia-lua (spec da Frente T): arco de 100 unidades (`pathLength`), traço 16
 * com pontas redondas, trilho `soft` e arco `act`. O arco anda em 450 ms com
 * `--ease-in-out` e o número do centro conta junto. Sem ícone de fogo.
 */
export function Medidor({ consumidas, meta }: MedidorProps) {
  const restante = Math.round((meta - consumidas) * 10) / 10;
  const acima = restante < 0;
  const frac = meta > 0 ? Math.min(consumidas / meta, 1) : 0;
  const numero = useContagem(Math.abs(restante));
  const rotulo = acima ? "kcal acima da meta" : "kcal que ainda cabem";
  const arco = "M22 96 A78 78 0 0 1 178 96";

  return (
    <div>
      <svg
        viewBox="0 0 200 104"
        role="img"
        aria-label={`${acima ? "Acima da meta" : "Ainda cabem"} ${formatKcal(Math.abs(restante))} kcal`}
        className="mt-1 block h-[150px] w-full"
      >
        <path d={arco} fill="none" stroke="var(--soft)" strokeWidth="16" strokeLinecap="round" />
        <path
          d={arco}
          fill="none"
          stroke="var(--act)"
          strokeWidth="16"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          style={{ strokeDashoffset: 100 - frac * 100 }}
          className="[transition:stroke-dashoffset_450ms_var(--ease-in-out)] motion-reduce:transition-none"
        />
        <text x="100" y="78" textAnchor="middle" fontSize="32" fontWeight="900" fill="var(--ink)">
          {formatKcal(numero)}
        </text>
        <text x="100" y="99" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--mut)">
          {rotulo}
        </text>
      </svg>
    </div>
  );
}
