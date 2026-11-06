import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Markdown } from "../../lib/markdown";
import { useAuthTheme } from "../../components/auth/authTheme";

export function Documento({ source }: { source: string }) {
  useAuthTheme();
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-act-text">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar
        </Link>
        <Markdown source={source} />
        <nav className="mt-8 flex gap-4 border-t border-line pt-4 text-sm text-mut" aria-label="Documentos legais">
          <Link to="/privacidade" className="underline">Política de Privacidade</Link>
          <Link to="/termos" className="underline">Termos de Uso</Link>
        </nav>
      </main>
    </div>
  );
}
