import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, Moon, Sun } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { getNavItems } from "../lib/navItems";

interface SidebarProps {
  collapsed: boolean; // recolhido pra só ícones (desktop)
  mobileOpen: boolean; // gaveta aberta (mobile)
  onCloseMobile: () => void;
  toggleTheme: () => void;
  isDark: boolean;
}

export function Sidebar({ collapsed, mobileOpen, onCloseMobile, toggleTheme, isDark }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = getNavItems(!!user?.is_superuser);

  function handleLogout() {
    logout();
    navigate("/"); // "Sair" leva pra home, não pra tela de login
  }

  function handleNavigate(path: string) {
    navigate(path);
    onCloseMobile(); // no mobile, fecha a gaveta ao escolher
  }

  // Largura: gaveta w-64 no mobile; no desktop, w-16 (recolhido) ou w-64 (aberto).
  const widthClass = collapsed ? "w-64 lg:w-16" : "w-64";
  // Rótulo: sempre visível no mobile; escondido no desktop quando recolhido.
  const labelClass = collapsed ? "lg:hidden" : "";
  const itemJustify = collapsed ? "lg:justify-center" : "lg:justify-start";

  return (
    <aside
      className={`fixed top-0 left-0 h-full z-40 ${widthClass} bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col transition-all duration-300
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
    >
      {/* Logo */}
      <div className={`h-16 flex items-center border-b border-zinc-200 dark:border-zinc-800 px-4 ${collapsed ? "lg:justify-center" : ""}`}>
        <img
          src="/nutri-agent-logo-horizontal.png"
          alt="NutriAgent"
          className={`h-9 w-auto object-contain ${labelClass}`}
        />
        <img
          src="/nutri-agent-icon.png"
          alt="NutriAgent"
          className={`h-8 w-8 object-contain hidden ${collapsed ? "lg:block" : ""}`}
        />
      </div>

      {/* Navegação */}
      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive =
            item.path === "/dashboard"
              ? location.pathname === "/dashboard"
              : location.pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => handleNavigate(item.path)}
              title={item.name}
              className={`w-full flex items-center justify-start ${itemJustify} gap-3 px-3.5 py-2.5 rounded-lg transition-all
                ${isActive
                  ? "bg-zinc-100 dark:bg-zinc-800/80 shadow-sm"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400"}`}
            >
              <item.icon className={`h-5 w-5 shrink-0 ${isActive ? item.color : ""}`} />
              <span className={`font-medium text-sm ${labelClass} ${isActive ? "text-zinc-900 dark:text-zinc-100" : ""}`}>
                {item.name}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 space-y-1">
        <button
          onClick={toggleTheme}
          title={isDark ? "Modo claro" : "Modo escuro"}
          className={`w-full flex items-center justify-start ${itemJustify} gap-3 px-3.5 py-2.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors`}
        >
          {isDark ? <Sun className="h-5 w-5 shrink-0" /> : <Moon className="h-5 w-5 shrink-0" />}
          <span className={`font-medium text-sm ${labelClass}`}>{isDark ? "Modo claro" : "Modo escuro"}</span>
        </button>

        <button
          onClick={handleLogout}
          title="Sair"
          className={`w-full flex items-center justify-start ${itemJustify} gap-3 px-3.5 py-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors`}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span className={`font-medium text-sm ${labelClass}`}>Sair</span>
        </button>
      </div>
    </aside>
  );
}
