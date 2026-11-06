import type { ReactNode } from "react";
import { NuviLogo } from "../brand/NuviLogo";
import { useAuthTheme } from "./authTheme";

/** Moldura das telas de entrada: fundo creme, logotipo e um cartão branco. */
export function AuthShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const dark = useAuthTheme();
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4 text-ink">
      <div className={`w-full ${wide ? "max-w-lg" : "max-w-md"}`}>
        <div className="mb-6 flex justify-center">
          <NuviLogo size={40} tone={dark ? "dark" : "light"} />
        </div>
        <div className="rounded-3xl border border-line bg-card p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}
