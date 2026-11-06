import { type ReactNode, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useLocation } from "react-router-dom";
import { SessionWatcher } from "../SessionWatcher";
import { OnboardingGate } from "../OnboardingGate";
import { SubscriptionExpiryBanner } from "../SubscriptionExpiryBanner";
import { CommandPalette } from "../CommandPalette";
import { NuviLogo } from "../brand/NuviLogo";
import { ROUTES } from "../../routes";
import { sectionTitleForPath } from "../../lib/navItems";
import { SideNav } from "./SideNav";
import { BottomTabBar } from "./BottomTabBar";
import { AccountMenu } from "./AccountMenu";
import { useWaveOncePerSession } from "./useWaveOncePerSession";

/** Casca do app: menu lateral (≥768 px), barra inferior (<768 px), busca rápida e tema. */
export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const logoWave = useWaveOncePerSession();
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return true;
    return (
      localStorage.getItem("theme") === "dark" ||
      (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  });
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  // O Hoje tem o próprio topo (logo, sino, avatar) e alterna o tema por fora da casca:
  // ele avisa pelo evento `nuvi:tema` e a casca relê o que ficou no <html>.
  useEffect(() => {
    const sync = () => setIsDark(document.documentElement.classList.contains("dark"));
    window.addEventListener("nuvi:tema", sync);
    return () => window.removeEventListener("nuvi:tema", sync);
  }, []);

  // Atalho global da busca rápida: ⌘K / Ctrl+K.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleTheme = () => setIsDark((d) => !d);

  return (
    <div className="flex min-h-dvh bg-bg text-ink">
      <SessionWatcher />
      <SideNav isDark={isDark} toggleTheme={toggleTheme} logoWave={logoWave} />

      <div className="flex h-dvh min-w-0 flex-1 flex-col pt-[var(--safe-top)] md:ml-64">
        <header
          className={`sticky top-0 z-20 h-16 shrink-0 items-center gap-3 border-b border-line bg-bg px-4 md:flex md:px-6 ${
            location.pathname === ROUTES.hoje ? "hidden" : "flex"
          }`}
        >
          <div className="md:hidden" data-splash-target>
            <NuviLogo size={26} tone={isDark ? "dark" : "light"} wave={logoWave} />
          </div>
          <h1 className="hidden truncate text-base font-extrabold md:block">{sectionTitleForPath(location.pathname)}</h1>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Buscar"
            className="flex items-center gap-2 rounded-xl bg-soft px-3 py-2 text-sm font-semibold text-mut"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Buscar</span>
            <kbd className="hidden rounded-sm border border-line px-1.5 py-0.5 text-[10px] sm:inline">⌘K</kbd>
          </button>
          <div className="md:hidden">
            <AccountMenu isDark={isDark} toggleTheme={toggleTheme} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-[calc(var(--tabbar-space)+24px)] md:p-8 md:pb-8">
          <div className="mx-auto max-w-7xl">
            <SubscriptionExpiryBanner />
            <OnboardingGate>{children}</OnboardingGate>
          </div>
        </main>
      </div>

      <BottomTabBar />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
