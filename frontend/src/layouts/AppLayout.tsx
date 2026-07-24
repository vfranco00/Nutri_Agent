import { type ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Menu, PanelLeft, Search } from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import { SessionWatcher } from "../components/SessionWatcher";
import { OnboardingGate } from "../components/OnboardingGate";
import { SubscriptionExpiryBanner } from "../components/SubscriptionExpiryBanner";
import { CommandPalette } from "../components/CommandPalette";
import { sectionTitleForPath } from "../lib/navItems";

interface AppLayoutProps {
  children: ReactNode;
  accentColor?: string;
}

export function AppLayout({ children, accentColor = "zinc" }: AppLayoutProps) {
  const location = useLocation();

  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("theme") === "dark" ||
        (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches)
      );
    }
    return true;
  });

  // Menu recolhido — lembrado no navegador entre visitas.
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("nutri_sidebar_collapsed") === "1",
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      localStorage.setItem("nutri_sidebar_collapsed", c ? "0" : "1");
      return !c;
    });
  }

  // Fecha a gaveta ao trocar de rota.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

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

  const sectionTitle = sectionTitleForPath(location.pathname);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 flex transition-colors duration-300">
      <SessionWatcher />
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        toggleTheme={() => setIsDark(!isDark)}
        isDark={isDark}
      />

      {/* Backdrop da gaveta no mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className={`flex-1 flex flex-col h-screen ml-0 ${collapsed ? "lg:ml-16" : "lg:ml-64"} transition-all duration-300`}>
        {/* Top bar: hambúrguer (mobile) / recolher (desktop), título da seção, busca */}
        <header className="h-16 shrink-0 flex items-center gap-3 px-4 lg:px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md sticky top-0 z-20">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            onClick={toggleCollapsed}
            className="hidden lg:inline-flex p-2 -ml-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Recolher menu"
          >
            <PanelLeft className="h-5 w-5" />
          </button>

          <h1 className="text-base font-semibold text-zinc-900 dark:text-white truncate">{sectionTitle}</h1>

          <div className="flex-1" />

          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg px-3 py-2 transition-colors"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Buscar</span>
            <kbd className="hidden sm:inline text-[10px] border border-zinc-300 dark:border-zinc-600 rounded px-1.5 py-0.5">⌘K</kbd>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className={`max-w-7xl mx-auto animate-fadeIn ${accentColor}`}>
            <SubscriptionExpiryBanner />
            <OnboardingGate>{children}</OnboardingGate>
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
