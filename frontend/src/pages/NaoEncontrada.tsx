import { Link } from "react-router-dom";
import { NuviLogo } from "../components/brand/NuviLogo";
import { useAuthTheme } from "../components/auth/authTheme";

/** Rota que não existe: antes caía numa página em branco. "/" leva ao Hoje se houver sessão. */
export function NaoEncontrada() {
  useAuthTheme();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-4 text-center text-ink">
      <NuviLogo size={36} tone="auto" />
      <div className="space-y-2">
        <h1 className="text-2xl font-black tracking-tight">Página não encontrada</h1>
        <p className="text-sm text-mut">O endereço não existe ou mudou de lugar.</p>
      </div>
      <Link
        to="/"
        className="rounded-full bg-act px-6 py-3 text-sm font-bold text-on-act"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
