import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Profile as ProfileType } from '../types';
import { ACTIVITY_LEVELS, GOALS, DIET_TYPES } from '../types';
import { Save, Loader2, Scale, Ruler, Calendar, Activity, Target, Plus, UserIcon, ArrowLeft } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface WeightData {
  id: number;
  weight: number;
  date: string;
}

export function Profile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  const [formData, setFormData] = useState<ProfileType>({
    age: 0, weight: 0, height: 0, gender: 'male', activity_level: 'sedentary', goal: 'lose_weight',
    diet_type: 'omnivore', allergies: '', food_likes: '', food_dislikes: ''
  });

  const [history, setHistory] = useState<WeightData[]>([]);
  const [newWeight, setNewWeight] = useState('');

  // Carregar Dados Iniciais
  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, historyRes] = await Promise.all([
          api.get('/profiles/me').catch(() => ({ data: null })),
          api.get('/profiles/weight/history').catch(() => ({ data: [] }))
        ]);

        if (profileRes.data) setFormData(profileRes.data);
        if (historyRes.data) setHistory(historyRes.data);
      } catch (error) {
        console.log('Perfil novo');
      } finally {
        setFetching(false);
      }
    }
    loadData();
  }, []);

  // --- CORREÇÃO AQUI: Salvar Perfil AGORA ATUALIZA O GRÁFICO ---
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Salva os dados cadastrais
      await api.put('/profiles/me', formData);
      
      // 2. FORÇA O SALVAMENTO DO PESO NO HISTÓRICO
      const weightRes = await api.post('/profiles/weight', { weight: formData.weight });
      
      // 3. Atualiza o gráfico localmente com o novo ponto
      setHistory([...history, weightRes.data]);
      
      alert('Perfil e Peso salvos com sucesso!');
    } catch (error) {
      alert('Erro ao salvar perfil.');
    } finally {
      setLoading(false);
    }
  }

  // Função do Botãozinho "Pesagem Rápida"
  async function handleAddWeight() {
    if (!newWeight) return;
    try {
      const weightVal = Number(newWeight);
      const res = await api.post('/profiles/weight', { weight: weightVal });
      
      setHistory([...history, res.data]);
      setFormData({ ...formData, weight: weightVal }); // Atualiza o input principal também
      setNewWeight('');
    } catch (error) {
      alert('Erro ao registrar peso.');
    }
  }

  if (fetching) return <div className="flex justify-center mt-20"><Loader2 className="animate-spin h-8 w-8 text-green-500" /></div>;

  return (
    <div className="max-w-5xl mx-auto">

      <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <ArrowLeft className="h-6 w-6 text-zinc-400" />
          </button>
          <h1 className="text-2xl font-bold text-green-600 dark:text-green-500 mb-6 flex items-center gap-2">
            <UserIcon className="h-6 w-6" /> Meu Perfil Nutricional
          </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUNA 1: Formulário */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSave} className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-6 shadow-sm">
            <h2 className="text-lg font-semibold dark:text-zinc-100">Dados Corporais</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-zinc-500 dark:text-zinc-400 flex gap-2"><Calendar className="h-4 w-4"/> Idade</label>
                <input type="number" required value={formData.age || ''} onChange={e => setFormData({...formData, age: Number(e.target.value)})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-green-500 dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-500 dark:text-zinc-400 flex gap-2"><Scale className="h-4 w-4"/> Peso (kg)</label>
                <input type="number" required step="0.1" value={formData.weight || ''} onChange={e => setFormData({...formData, weight: Number(e.target.value)})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-green-500 dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-500 dark:text-zinc-400 flex gap-2"><Ruler className="h-4 w-4"/> Altura (cm)</label>
                <input type="number" required value={formData.height || ''} onChange={e => setFormData({...formData, height: Number(e.target.value)})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-green-500 dark:text-white" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-zinc-500 dark:text-zinc-400 flex gap-2"><Activity className="h-4 w-4"/> Nível de Atividade</label>
                <select value={formData.activity_level} onChange={e => setFormData({...formData, activity_level: e.target.value as any})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none dark:text-zinc-100">
                  {Object.entries(ACTIVITY_LEVELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-500 dark:text-zinc-400 flex gap-2"><Target className="h-4 w-4"/> Objetivo</label>
                <select value={formData.goal} onChange={e => setFormData({...formData, goal: e.target.value as any})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none dark:text-zinc-100">
                  {Object.entries(GOALS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
              <h3 className="text-md font-semibold text-green-600 dark:text-green-500">Preferências Alimentares</h3>
              <div className="space-y-2">
                <label className="text-sm text-zinc-500 dark:text-zinc-400">Tipo de Dieta</label>
                <select value={formData.diet_type || 'omnivore'} onChange={e => setFormData({...formData, diet_type: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none dark:text-zinc-100">
                  {Object.entries(DIET_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-500 dark:text-zinc-400">Alergias (Separar por vírgula)</label>
                <input type="text" value={formData.allergies || ''} onChange={e => setFormData({...formData, allergies: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-red-500/50 dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-500 dark:text-zinc-400">O que você MAIS gosta?</label>
                <textarea rows={2} value={formData.food_likes || ''} onChange={e => setFormData({...formData, food_likes: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-green-500 dark:text-white resize-none" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-500 dark:text-zinc-400">O que você DETESTA?</label>
                <textarea rows={2} value={formData.food_dislikes || ''} onChange={e => setFormData({...formData, food_dislikes: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-red-500/50 dark:text-white resize-none" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg flex justify-center gap-2">
              {loading ? <Loader2 className="animate-spin"/> : <Save className="h-5 w-5"/>} Salvar Perfil e Histórico
            </button>
          </form>
        </div>

        {/* COLUNA 2: Gráfico e Histórico */}
        <div className="space-y-6">
          
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-zinc-800 dark:text-zinc-100 font-semibold mb-4 flex items-center gap-2">
              <Scale className="h-5 w-5 text-blue-500" /> Pesagem Rápida
            </h3>
            <div className="flex gap-2">
              <input 
                type="number" 
                placeholder="Peso hoje (kg)" 
                value={newWeight}
                onChange={e => setNewWeight(e.target.value)}
                className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              />
              <button 
                onClick={handleAddWeight}
                className="bg-blue-600 hover:bg-blue-700 p-2 rounded-lg text-white transition-colors"
              >
                <Plus className="h-6 w-6" />
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 h-80 shadow-sm">
            <h3 className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mb-4">Evolução do Peso</h3>
            
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} opacity={0.1} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#71717a" 
                    fontSize={12}
                    tickFormatter={(str) => format(new Date(str), 'dd/MM')}
                  />
                  <YAxis stroke="#71717a" fontSize={12} domain={['dataMin - 2', 'dataMax + 2']} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px', color: '#fff' }}
                    labelFormatter={(label) => format(new Date(label), 'dd/MM/yyyy HH:mm')}
                  />
                  <Area type="monotone" dataKey="weight" stroke="#10b981" fillOpacity={1} fill="url(#colorWeight)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-500 text-sm text-center">
                Registre seu peso para ver o gráfico
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}