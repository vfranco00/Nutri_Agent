import { Sparkles } from "lucide-react";
import { Button } from "./ui/Button";

/** Selo discreto "Em breve" para acompanhar um botão ou rótulo que depende da IA. */
export function SeloEmBreve({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-soft px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-mut ${className}`}
    >
      Em breve
    </span>
  );
}

/** Aviso que ocupa o lugar de uma tela/ação de IA enquanto o interruptor `IA_DISPONIVEL` está desligado. */
export function EmBreve({
  texto = "A IA do Nuvi está em manutenção e volta logo. Enquanto isso, registre pelo diário, pela busca ou pelo código de barras.",
  acao,
  className = "",
}: {
  texto?: string;
  acao?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <section
      aria-label="Em breve"
      className={`rounded-3xl border-2 border-dashed border-line bg-card p-6 text-center ${className}`}
    >
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-soft text-act-text">
        <Sparkles aria-hidden="true" className="h-5 w-5" />
      </div>
      <h2 className="mt-3 text-lg font-black">Em breve</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-mut">{texto}</p>
      {acao ? (
        <Button onClick={acao.onClick} className="mt-4">
          {acao.label}
        </Button>
      ) : null}
    </section>
  );
}
