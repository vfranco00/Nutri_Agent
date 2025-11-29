import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User as UserIcon, ChefHat, Activity, Shield, Sparkles } from 'lucide-react';
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

      <main className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Olá, {user?.full_name || 'Visitante'} 👋</h1>
          <p className="text-zinc-400">Gerencie sua dieta e use a IA a seu favor.</p>
        </div>

        {/* Grid ajustado para 4 colunas em telas grandes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Card 1: Perfil */}
          <div 
            onClick={() => navigate('/profile')}
            className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 hover:border-green-500/50 transition-all cursor-pointer group hover:-translate-y-1"
          >
            <div className="h-12 w-12 bg-green-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-green-500/20 transition-colors">
              <UserIcon className="h-6 w-6 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Meu Perfil</h3>
            <p className="text-sm text-zinc-400">Seu peso, altura, histórico e objetivos.</p>
          </div>

          {/* Card 2: Receitas */}
          <div 
            onClick={() => navigate('/recipes')}
            className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 hover:border-orange-500/50 transition-all cursor-pointer group hover:-translate-y-1"
          >
            <div className="h-12 w-12 bg-orange-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-orange-500/20 transition-colors">
              <ChefHat className="h-6 w-6 text-orange-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Minhas Receitas</h3>
            <p className="text-sm text-zinc-400">Seu livro de receitas com cálculo automático.</p>
          </div>

          {/* Card 3: Cardápio IA */}
          <div 
            onClick={() => navigate('/ai-plan')}
            className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 hover:border-purple-500/50 transition-all cursor-pointer group hover:-translate-y-1"
          >
            <div className="h-12 w-12 bg-purple-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-colors">
              <Activity className="h-6 w-6 text-purple-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Gerar Cardápio</h3>
            <p className="text-sm text-zinc-400">IA monta sua dieta baseada no seu perfil.</p>
          </div>

          {/* Card 4: Chef IA (NOVO) */}
          <div 
            onClick={() => navigate('/ai-chef')}
            className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 hover:border-blue-500/50 transition-all cursor-pointer group hover:-translate-y-1"
          >
            <div className="h-12 w-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
              <Sparkles className="h-6 w-6 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Chef IA</h3>
            <p className="text-sm text-zinc-400">Diga o que tem na geladeira e a IA cria a receita.</p>
          </div>

        </div>
      </main>
    </div>
  );
}