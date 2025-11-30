import { useNavigate, useLocation } from 'react-router-dom';
import { Home, User, ChefHat, Activity, LogOut, Moon, Sun, ArrowLeft, Sparkles } from 'lucide-react';

interface SidebarProps {
  toggleTheme: () => void;
  isDark: boolean;
}

export function Sidebar({ toggleTheme, isDark }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { name: 'Início', icon: Home, path: '/dashboard', color: 'text-zinc-500 dark:text-zinc-400' },
    { name: 'Meu Perfil', icon: User, path: '/profile', color: 'text-green-500' },
    { name: 'Minhas Receitas', icon: ChefHat, path: '/recipes', color: 'text-orange-500' },
    { name: 'Gerar Cardápio', icon: Activity, path: '/ai-plan', color: 'text-purple-500' }, // <--- Corrigido
    { name: 'Chef IA', icon: Sparkles, path: '/ai-chef', color: 'text-blue-500' }, // <--- Adicionado
  ];

  function handleLogout() {
    localStorage.removeItem('nutri_token');
    navigate('/login');
  }

  return (
    <aside className="w-20 lg:w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col transition-all duration-300 fixed h-full z-20">
      
      {/* Logo Area */}
      <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-2xl mr-2">🍎</span>
        <span className="font-bold text-xl dark:text-white hidden lg:block">NutriAgent</span>
      </div>

      {/* Navegação */}
      <nav className="flex-1 py-6 space-y-2 px-2">
        
        <button 
          onClick={() => navigate(-1)}
          className="w-full flex items-center justify-center lg:justify-start gap-3 px-4 py-3 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="hidden lg:block font-medium">Voltar</span>
        </button>

        {menuItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-lg transition-all
                ${isActive 
                  ? 'bg-zinc-100 dark:bg-zinc-800/80 shadow-sm' 
                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400'}
              `}
            >
              <item.icon className={`h-5 w-5 ${isActive ? item.color : ''}`} />
              <span className={`hidden lg:block font-medium ${isActive ? 'text-zinc-900 dark:text-zinc-100' : ''}`}>
                {item.name}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Footer Actions */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-center lg:justify-start gap-3 px-4 py-3 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          <span className="hidden lg:block font-medium">{isDark ? 'Modo Claro' : 'Modo Escuro'}</span>
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center lg:justify-start gap-3 px-4 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span className="hidden lg:block font-medium">Sair</span>
        </button>
      </div>
    </aside>
  );
}