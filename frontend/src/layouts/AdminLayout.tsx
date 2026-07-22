import type { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Shield, BarChart3, Users, ArrowLeft } from "lucide-react";

interface AdminLayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { path: "/admin", label: "Métricas", icon: BarChart3 },
  { path: "/admin/users", label: "Usuários", icon: Users },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 text-red-500 font-bold">
              <Shield className="h-6 w-6" /> Painel Admin
            </div>
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-red-500/10 text-red-400"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                    }`}
                  >
                    <item.icon className="h-4 w-4" /> {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao app
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
