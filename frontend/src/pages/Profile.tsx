import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { type Profile as ProfileType, ACTIVITY_LEVELS, GOALS } from '../types';
import { Save, ArrowLeft, Loader2, Scale, Ruler, Calendar, Activity, Target } from 'lucide-react';

export function Profile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true); // Estado inicial de carregamento
  
  // Estado do formulário
  const [formData, setFormData] = useState<ProfileType>({
    age: 0,
    weight: 0,
    height: 0,
    gender: 'male',
    activity_level: 'sedentary',
    goal: 'lose_weight',
  });

  // 1. Carregar dados ao abrir a tela
  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await api.get('/profiles/me');
        if (response.data) {
          setFormData(response.data);
        }
      } catch (error) {
        console.log('Perfil ainda não existe, usuário vai criar agora.');
        return error
      } finally {
        setFetching(false);
      }
    }
    loadProfile();
  }, []);

  // 2. Salvar dados
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      await api.put('/profiles/me', formData);
      alert('Perfil salvo com sucesso!');
      navigate('/dashboard');
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar perfil.');
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-green-500">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-4">
      <div className="max-w-2xl mx-auto">
        
        {/* Header com botão de voltar */}
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-6 w-6 text-zinc-400" />
          </button>
          <h1 className="text-2xl font-bold text-green-500">Meu Perfil Nutricional</h1>
        </div>

        <form onSubmit={handleSave} className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Idade */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Idade
              </label>
              <input
                type="number"
                required
                min="1"
                value={formData.age || ''}
                onChange={e => setFormData({...formData, age: Number(e.target.value)})}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 focus:ring-2 focus:ring-green-500 outline-none"
              />
            </div>

            {/* Peso */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                <Scale className="h-4 w-4" /> Peso (kg)
              </label>
              <input
                type="number"
                required
                step="0.1"
                value={formData.weight || ''}
                onChange={e => setFormData({...formData, weight: Number(e.target.value)})}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 focus:ring-2 focus:ring-green-500 outline-none"
              />
            </div>

            {/* Altura */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                <Ruler className="h-4 w-4" /> Altura (cm)
              </label>
              <input
                type="number"
                required
                value={formData.height || ''}
                onChange={e => setFormData({...formData, height: Number(e.target.value)})}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 focus:ring-2 focus:ring-green-500 outline-none"
              />
            </div>
          </div>

          {/* Gênero */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400">Gênero Biológico</label>
            <div className="flex gap-4">
              <label className={`flex-1 p-3 rounded-lg border cursor-pointer transition-colors ${formData.gender === 'male' ? 'bg-green-500/20 border-green-500 text-green-500' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                <input 
                  type="radio" 
                  name="gender" 
                  value="male" 
                  className="hidden" 
                  checked={formData.gender === 'male'}
                  onChange={() => setFormData({...formData, gender: 'male'})}
                />
                <div className="text-center font-medium">Masculino</div>
              </label>
              <label className={`flex-1 p-3 rounded-lg border cursor-pointer transition-colors ${formData.gender === 'female' ? 'bg-green-500/20 border-green-500 text-green-500' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                <input 
                  type="radio" 
                  name="gender" 
                  value="female" 
                  className="hidden"
                  checked={formData.gender === 'female'}
                  onChange={() => setFormData({...formData, gender: 'female'})}
                />
                <div className="text-center font-medium">Feminino</div>
              </label>
            </div>
          </div>

          {/* Nível de Atividade */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <Activity className="h-4 w-4" /> Nível de Atividade
            </label>
            <select
              value={formData.activity_level}
              onChange={e => setFormData({...formData, activity_level: e.target.value as any})}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 focus:ring-2 focus:ring-green-500 outline-none text-zinc-100"
            >
              {Object.entries(ACTIVITY_LEVELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Objetivo */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <Target className="h-4 w-4" /> Objetivo Principal
            </label>
            <select
              value={formData.goal}
              onChange={e => setFormData({...formData, goal: e.target.value as any})}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 focus:ring-2 focus:ring-green-500 outline-none text-zinc-100"
            >
              {Object.entries(GOALS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Botão Salvar */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-lg transition-all flex items-center justify-center gap-2 mt-4"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Save className="h-5 w-5" />}
            Salvar Perfil
          </button>

        </form>
      </div>
    </div>
  );
}