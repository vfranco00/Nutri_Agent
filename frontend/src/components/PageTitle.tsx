import type { ReactNode } from "react";

/** Título de tela do protótipo Nuvi: duas partes, a segunda em laranja-texto. */
export function PageTitle({ a, b, action }: { a: string; b?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-[26px] font-black leading-[1.05] tracking-[-0.025em] text-ink">
        {a}
        {b ? <> <span className="text-act-text">{b}</span></> : null}
      </h2>
      {action}
    </div>
  );
}
