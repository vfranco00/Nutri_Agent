import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { ROUTES } from "../../routes";
import { Registrar } from "../../pages/registrar/Registrar";

/**
 * Folha de Registrar por cima da tela de fundo. Celular: sobe de baixo; computador:
 * painel à direita. O conteúdo (abas Buscar, Recentes…, carrinho) é o `Registrar`.
 */
export function RegistrarOutlet() {
  const navigate = useNavigate();
  const location = useLocation();
  const fecharRef = useRef<HTMLButtonElement>(null);
  const veioDeFundo = !!(location.state as { background?: unknown } | null)?.background;

  function fechar() {
    // Voltar do sistema e o X fazem o mesmo: sai da folha e mostra a tela de fundo.
    if (veioDeFundo) navigate(-1);
    else navigate(ROUTES.hoje, { replace: true });
  }

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    fecharRef.current?.focus();
    return () => anterior?.focus?.();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50"
      onKeyDown={(e) => {
        if (e.key === "Escape") fechar();
      }}
    >
      <div className="registrar-fundo absolute inset-0 bg-black/45" onClick={fechar} aria-hidden="true" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Registrar"
        className="registrar-sheet absolute inset-x-0 bottom-0 flex pb-[var(--safe-bottom)] md:pb-0 max-h-[92dvh] flex-col rounded-t-[28px] bg-card text-ink md:inset-x-auto md:right-0 md:top-0 md:h-full md:max-h-none md:w-[440px] md:rounded-none md:rounded-l-[28px]"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line md:hidden" aria-hidden="true" />
        <header className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 className="text-lg font-extrabold">Registrar</h2>
          <button
            ref={fecharRef}
            type="button"
            onClick={fechar}
            aria-label="Fechar"
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-soft text-ink active:scale-[.97]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <Registrar onClose={fechar} />
      </section>
    </div>
  );
}
