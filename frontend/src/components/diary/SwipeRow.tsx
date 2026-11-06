import { useRef, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";

const LIMITE_PX = 88;

interface SwipeRowProps {
  children: ReactNode;
  onDelete: () => void;
  /** Nome para o botão acessível ("Apagar arroz"). */
  label: string;
  disabled?: boolean;
}

/**
 * Arrastar para a esquerda apaga (com desfazer, a cargo de quem chama). Soltar antes do
 * limite volta sem apagar. Quem não arrasta (teclado, leitor de tela) usa o botão "Apagar".
 */
export function SwipeRow({ children, onDelete, label, disabled }: SwipeRowProps) {
  const [dx, setDx] = useState(0);
  const [arrastando, setArrastando] = useState(false);
  const dxRef = useRef(0);
  const inicio = useRef<{ x: number; y: number; travado: boolean } | null>(null);

  function aoComecar(e: React.PointerEvent) {
    if (disabled) return;
    inicio.current = { x: e.clientX, y: e.clientY, travado: false };
  }
  function aoMover(e: React.PointerEvent) {
    const i = inicio.current;
    if (!i) return;
    const mx = e.clientX - i.x;
    const my = e.clientY - i.y;
    if (!i.travado) {
      if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) {
        inicio.current = null; // rolagem vertical: não é gesto de apagar
        return;
      }
      if (Math.abs(mx) < 8) return;
      i.travado = true;
      setArrastando(true);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      } catch {
        /* ponteiro sintético ou já solto: o gesto segue sem captura */
      }
    }
    dxRef.current = Math.min(0, mx);
    setDx(dxRef.current);
  }
  function aoSoltar() {
    const passou = dxRef.current <= -LIMITE_PX;
    dxRef.current = 0;
    inicio.current = null;
    setArrastando(false);
    setDx(0);
    if (passou) onDelete();
  }

  return (
    <div className="relative overflow-hidden">
      <div style={{ opacity: dx < 0 ? 1 : 0 }} className="absolute inset-y-0 right-0 flex w-full items-center justify-end bg-red-600 pr-6 text-white" aria-hidden="true">
        <Trash2 className="h-5 w-5" />
      </div>
      <div
        data-testid="swipe-conteudo"
        onPointerDown={aoComecar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
        style={{ transform: `translateX(${dx}px)`, touchAction: "pan-y" }}
        className={`relative select-none ${arrastando ? "" : "transition-transform duration-[220ms] ease-out"}`}
      >
        {children}
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          aria-label={`Apagar ${label}`}
          className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:right-2 focus-visible:top-1/2 focus-visible:-translate-y-1/2 focus-visible:rounded-xl focus-visible:bg-red-600 focus-visible:p-2 focus-visible:text-white"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
