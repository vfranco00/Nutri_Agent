import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Moon, Plus, Sun } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { getNavGroups } from "../../lib/navItems";
import { openRegistrar } from "../../routes";
import { NuviLogo } from "../brand/NuviLogo";

interface SideNavProps {
  isDark: boolean;
  toggleTheme: () => void;
  /** Onda do logo: o Splash (F5) decide quando ligar. */
  logoWave?: boolean | "once";
}

/** Menu lateral do computador (a partir de 768 px), com "+ Registrar" no topo. */
export function SideNav({ isDark, toggleTheme, logoWave = false }: SideNavProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const grupos = getNavGroups(!!user?.is_superuser);

  return (
    <aside className="fixed left-0 top-0 pt-[var(--safe-top)] z-40 hidden h-full w-64 flex-col border-r border-line bg-card md:flex">
      <div className="flex h-16 items-center px-5" data-splash-target>
        <NuviLogo size={28} tone={isDark ? "dark" : "light"} wave={logoWave} />
      </div>

      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={() => openRegistrar(navigate, location)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-act px-4 py-3 text-sm font-extrabold text-on-act active:scale-[.97]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.8} aria-hidden="true" />
          Registrar
        </button>
      </div>

      <nav aria-label="Principal" className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {grupos.map((g) => (
          <div key={g.title}>
            <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-mut">{g.title}</p>
            <ul className="space-y-0.5">
              {g.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={g.items.some((o) => o !== item && o.path.startsWith(item.path + "/"))}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold ${
                        isActive ? "bg-act-soft text-ink" : "text-mut hover:bg-soft"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-act-text" : ""}`} aria-hidden="true" />
                        {item.name}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-line p-3">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-mut hover:bg-soft"
        >
          {isDark ? <Sun className="h-[18px] w-[18px]" aria-hidden="true" /> : <Moon className="h-[18px] w-[18px]" aria-hidden="true" />}
          {isDark ? "Modo claro" : "Modo escuro"}
        </button>
        <button
          type="button"
          onClick={() => {
            logout();
            navigate("/");
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-soft dark:text-red-400"
        >
          <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
          Sair
        </button>
      </div>
    </aside>
  );
}
