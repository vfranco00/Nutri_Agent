import { fecharToast, TOAST_TRANSICAO_MS, useToasts } from "./toastStore";

/** Monte uma vez na raiz do app. Sobe de baixo por transição; acima da barra inferior no celular. */
export function Toaster() {
  const itens = useToasts();
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-28 z-[90] flex flex-col items-center gap-2 px-4 md:bottom-6"
      role="region"
      aria-label="Avisos"
    >
      {itens.map((t) => (
        <div
          key={t.id}
          role="status"
          style={{ transitionDuration: `${TOAST_TRANSICAO_MS}ms` }}
          className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-bar px-4 py-3 text-sm font-semibold text-bar-on shadow-lg transition-[transform,opacity] ease-out ${
            t.fase === "visivel" ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          <span>{t.message}</span>
          {t.action ? (
            <button
              type="button"
              onClick={() => {
                t.action!.onClick();
                fecharToast(t.id);
              }}
              className="rounded-lg px-2 py-1 font-extrabold text-nuvi-gomo active:scale-[.97]"
            >
              {t.action.label}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
