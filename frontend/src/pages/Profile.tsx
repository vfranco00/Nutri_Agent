import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { type Profile as ProfileType, ACTIVITY_LEVELS, GOALS } from '../types';
import { Save, ArrowLeft, Loader2, Scale, Ruler, Calendar, Activity, Target, Plus } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface WeightData {
  id: number;
  weight: number;
  date: string;
}

export function Profile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  // Estado do Perfil
  const [formData, setFormData] = useState<ProfileType>({
    age: 0, weight: 0, height: 0, gender: 'male', activity_level: 'sedentary', goal: 'lose_weight',
  });

  // Estado do Histórico de Peso
  const [history, setHistory] = useState<WeightData[]>([]);
  const [newWeight, setNewWeight] = useState('');

  // Carregar dados
  useEffect(() => {
    async function loadData() {
      try {
        // Busca Perfil e Histórico em paralelo
        const [profileRes, historyRes] = await Promise.all([
          api.get('/profiles/me').catch(() => ({ data: null })), // Se não tiver perfil, retorna null sem erro
          api.get('/profiles/weight/history').catch(() => ({ data: [] }))
        ]);

        if (profileRes.data) setFormData(profileRes.data);
        if (historyRes.data) setHistory(historyRes.data);

      } catch (error) {
        console.error("Erro ao carregar dados", error);
      } finally {
        setFetching(false);
      }
    }
    loadData();
  }, []);

  // Salvar Perfil Completo
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put('/profiles/me', formData);
      alert('Perfil salvo com sucesso!');
    } catch (error) {
      alert('Erro ao salvar perfil.');
    } finally {
      setLoading(false);
    }
  }

  // Registrar Novo Peso (Histórico)
  async function handleAddWeight() {
    if (!newWeight) return;
    try {
      const weightVal = Number(newWeight);
      // Salva no histórico
      const res = await api.post('/profiles/weight', { weight: weightVal });
      
      // Atualiza o gráfico e o formulário principal na hora
      setHistory([...history, res.data]);
      setFormData({ ...formData, weight: weightVal });
      setNewWeight('');
      
    } catch (error) {
      alert('Erro ao registrar peso.');
    }
  }

  if (fetching) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-green-500"><Loader2 className="animate-spin h-8 w-8" /></div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-4">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <ArrowLeft className="h-6 w-6 text-zinc-400" />
          </button>
          <h1 className="text-2xl font-bold text-green-500">Meu Perfil Nutricional</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* COLUNA 1: Formulário de Dados (Ocupa 2 colunas no desktop) */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSave} className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 space-y-6">
              <h2 className="text-lg font-semibold text-zinc-100 mb-4">Dados Corporais</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400 flex gap-2"><Calendar className="h-4 w-4"/> Idade</label>
                  <input type="number" required value={formData.age || ''} onChange={e => setFormData({...formData, age: Number(e.target.value)})} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400 flex gap-2"><Scale className="h-4 w-4"/> Peso (kg)</label>
                  <input type="number" required step="0.1" value={formData.weight || ''} onChange={e => setFormData({...formData, weight: Number(e.target.value)})} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400 flex gap-2"><Ruler className="h-4 w-4"/> Altura (cm)</label>
                  <input type="number" required value={formData.height || ''} onChange={e => setFormData({...formData, height: Number(e.target.value)})} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-zinc-400 flex gap-2"><Activity className="h-4 w-4"/> Nível de Atividade</label>
                <select value={formData.activity_level} onChange={e => setFormData({...formData, activity_level: e.target.value as any})} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 outline-none text-zinc-100">
                  {Object.entries(ACTIVITY_LEVELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-zinc-400 flex gap-2"><Target className="h-4 w-4"/> Objetivo</label>
                <select value={formData.goal} onChange={e => setFormData({...formData, goal: e.target.value as any})} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 outline-none text-zinc-100">
                  {Object.entries(GOALS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>

              <button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg flex justify-center gap-2">
                {loading ? <Loader2 className="animate-spin"/> : <Save className="h-5 w-5"/>} Salvar Dados
              </button>
            </form>
          </div>

          {/* COLUNA 2: Histórico e Gráfico */}
          <div className="space-y-6">
            
            {/* Card de Registro Rápido */}
            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
              <h3 className="text-zinc-100 font-semibold mb-4 flex items-center gap-2">
                <Scale className="h-5 w-5 text-blue-500" /> Pesagem Rápida
              </h3>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  placeholder="Peso hoje (kg)" 
                  value={newWeight}
                  onChange={e => setNewWeight(e.target.value)}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button 
                  onClick={handleAddWeight}
                  className="bg-blue-600 hover:bg-blue-700 p-2 rounded-lg text-white transition-colors"
                >
                  <Plus className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Gráfico */}
            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 h-80">
              <h3 className="text-zinc-400 text-sm font-medium mb-4">Evolução do Peso</h3>
              
              {history.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#71717a" 
                      fontSize={12}
                      tickFormatter={(str) => format(new Date(str), 'dd/MM')}
                    />
                    <YAxis 
                      stroke="#71717a" 
                      fontSize={12} 
                      domain={['dataMin - 2', 'dataMax + 2']} 
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46' }}
                      labelFormatter={(label) => format(new Date(label), 'dd/MM/yyyy HH:mm')}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="weight" 
                      stroke="#10b981" 
                      fillOpacity={1} 
                      fill="url(#colorWeight)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-600 text-sm text-center">
                  Registre seu peso para ver o gráfico
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}