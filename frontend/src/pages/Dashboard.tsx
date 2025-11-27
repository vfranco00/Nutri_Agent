import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User as UserIcon, ChefHat, Activity, Shield } from 'lucide-react';
import { api } from '../lib/api';
import type { User } from '../types';

export function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    api.get('/users/me')
      .then(response => setUser(response.data))
      .catch(err => console.error(err));
  }, []);

  function handleLogout() {
    localStorage.removeItem('nutri_token');
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="border-b border-zinc-800 bg-zinc-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🍎</span>
          <span className="font-bold text-xl text-green-500">NutriAgent</span>
        </div>
        
        <div className="flex items-center gap-6">
          {user?.is_superuser && (
            <button 
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors text-sm font-bold border border-red-500/20 px-3 py-1.5 rounded-lg bg-red-500/10"
            >
              <Shield className="h-4 w-4" />
              Painel Admin
            </button>
          )}

          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-zinc-400 hover:text-red-400 transition-colors text-sm font-medium"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Bem-vindo ao seu Painel</h1>
        <p className="text-zinc-400 mb-8">Aqui começa sua transformação.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div 
            onClick={() => navigate('/profile')}
            className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 hover:border-green-500/50 transition-colors cursor-pointer group"
          >
            <div className="h-12 w-12 bg-green-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-green-500/20 transition-colors">
              <UserIcon className="h-6 w-6 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Meu Perfil</h3>
            <p className="text-sm text-zinc-400">Atualize seu peso, altura e objetivos nutricionais.</p>
          </div>

          <div 
            onClick={() => navigate('/recipes')}
            className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 hover:border-orange-500/50 transition-colors cursor-pointer group"
          >
            <div className="h-12 w-12 bg-orange-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-orange-500/20 transition-colors">
              <ChefHat className="h-6 w-6 text-orange-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Minhas Receitas</h3>
            <p className="text-sm text-zinc-400">Gerencie seus pratos e ingredientes favoritos.</p>
          </div>

          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 hover:border-purple-500/50 transition-colors cursor-pointer group opacity-75">
            <div className="h-12 w-12 bg-purple-500/10 rounded-lg flex items-center justify-center mb-4">
              <Activity className="h-6 w-6 text-purple-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Gerar Plano (IA)</h3>
            <p className="text-sm text-zinc-400">Em breve: Inteligência Artificial para montar sua dieta.</p>
          </div>

        </div>
      </main>
    </div>
  );
}