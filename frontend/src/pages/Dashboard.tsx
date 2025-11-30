import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User as UserIcon, ChefHat, Activity, Sparkles, Scale, ShoppingCart, LibrarySquare, Book, CheckCheck } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { api } from '../lib/api';
import type { User } from '../types';

interface WeightData {
  date: string;
  weight: number;
}

export function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [history, setHistory] = useState<WeightData[]>([]);

  useEffect(() => {
    api.get('/users/me').then(res => setUser(res.data)).catch(console.error);
    api.get('/profiles/weight/history').then(res => setHistory(res.data)).catch(() => setHistory([]));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2 dark:text-white">Olá, {user?.full_name || 'Visitante'} 👋</h1>
        <p className="text-zinc-500 dark:text-zinc-400">Acompanhe seu progresso e gerencie sua dieta.</p>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold dark:text-white flex items-center gap-2">
            <Scale className="h-5 w-5 text-blue-500" /> Evolução de Peso
          </h3>
          <button 
            onClick={() => navigate('/profile')}
            className="text-sm text-blue-500 hover:text-blue-400 font-medium"
          >
            + Registrar Peso
          </button>
        </div>
        
        <div className="h-64 w-full">
          {history.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} opacity={0.2} />
                <XAxis 
                  dataKey="date" 
                  stroke="#71717a" 
                  fontSize={12}
                  tickFormatter={(str) => format(new Date(str), 'dd/MM')}
                />
                <YAxis stroke="#71717a" fontSize={12} domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px', color: '#fff' }}
                  labelFormatter={(label) => format(new Date(label), 'dd/MM HH:mm')}
                />
                <Area type="monotone" dataKey="weight" stroke="#3b82f6" fillOpacity={1} fill="url(#colorWeight)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
              Nenhum dado registrado. Vá em Perfil para começar.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div onClick={() => navigate('/profile')} className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-green-500 transition-all cursor-pointer group hover:-translate-y-1 shadow-sm">
          <div className="h-12 w-12 bg-green-100 dark:bg-green-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-green-200 dark:group-hover:bg-green-500/20 transition-colors">
            <UserIcon className="h-6 w-6 text-green-600 dark:text-green-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2 dark:text-white">Meu Perfil</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Metas e dados corporais.</p>
        </div>

        <div onClick={() => navigate('/recipes')} className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-orange-500 transition-all cursor-pointer group hover:-translate-y-1 shadow-sm">
          <div className="h-12 w-12 bg-orange-100 dark:bg-orange-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-orange-200 dark:group-hover:bg-orange-500/20 transition-colors">
            <Book className="h-6 w-6 text-orange-600 dark:text-orange-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2 dark:text-white">Minhas Receitas</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Gerencie seus pratos.</p>
        </div>

        <div onClick={() => navigate('/ai-plan')} className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-purple-500 transition-all cursor-pointer group hover:-translate-y-1 shadow-sm">
          <div className="h-12 w-12 bg-purple-100 dark:bg-purple-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-purple-200 dark:group-hover:bg-purple-500/20 transition-colors">
            <CheckCheck className="h-6 w-6 text-purple-600 dark:text-purple-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2 dark:text-white">Gerar Cardápio</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Dieta personalizada com IA.</p>
        </div>

        <div onClick={() => navigate('/ai-chef')} className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 transition-all cursor-pointer group hover:-translate-y-1 shadow-sm">
          <div className="h-12 w-12 bg-blue-100 dark:bg-blue-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-200 dark:group-hover:bg-blue-500/20 transition-colors">
            <ChefHat className="h-6 w-6 text-blue-600 dark:text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2 dark:text-white">Chef IA</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Receitas com o que você tem.</p>
        </div>

        <div onClick={() => navigate('/shopping')} className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-pink-500 transition-all cursor-pointer group hover:-translate-y-1 shadow-sm">
          <div className="h-12 w-12 bg-pink-100 dark:bg-pink-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-pink-200 dark:group-hover:bg-pink-500/20 transition-colors">
            <ShoppingCart className="h-6 w-6 text-pink-600 dark:text-pink-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2 dark:text-white">Lista de Compras</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Organize suas compras.</p>
        </div>

      </div>
    </div>
  );
}