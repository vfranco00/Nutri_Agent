import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { ArrowLeft, Save, Clock, Flame, Type, AlignLeft, Loader2 } from 'lucide-react';

export function NewRecipe() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Estados do formulário
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [calories, setCalories] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      // Envia pro backend
      await api.post('/recipes/', {
        title,
        instructions,
        prep_time: Number(prepTime) || 0,
        calories: Number(calories) || 0,
        description: '' // Opcional
      });

      // Volta pra lista
      navigate('/recipes');

    } catch (error) {
      console.error(error);
      alert('Erro ao criar receita.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-4">
      <div className="max-w-2xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => navigate('/recipes')}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-6 w-6 text-zinc-400" />
          </button>
          <h1 className="text-2xl font-bold text-green-500">Nova Receita</h1>
        </div>

        <form onSubmit={handleSave} className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 space-y-6">
          
          {/* Título */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <Type className="h-4 w-4" /> Nome do Prato
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Frango Grelhado com Salada"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 focus:ring-2 focus:ring-green-500 outline-none placeholder-zinc-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Tempo de Preparo */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Tempo (min)
              </label>
              <input
                type="number"
                placeholder="Ex: 30"
                value={prepTime}
                onChange={e => setPrepTime(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 focus:ring-2 focus:ring-green-500 outline-none placeholder-zinc-600"
              />
            </div>

            {/* Calorias */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                <Flame className="h-4 w-4" /> Calorias (kcal)
              </label>
              <input
                type="number"
                placeholder="Ex: 450"
                value={calories}
                onChange={e => setCalories(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 focus:ring-2 focus:ring-green-500 outline-none placeholder-zinc-600"
              />
            </div>
          </div>

          {/* Instruções */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <AlignLeft className="h-4 w-4" /> Modo de Preparo
            </label>
            <textarea
              required
              rows={5}
              placeholder="Descreva o passo a passo..."
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 focus:ring-2 focus:ring-green-500 outline-none placeholder-zinc-600 resize-none"
            />
          </div>

          {/* Botão Salvar */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-lg transition-all flex items-center justify-center gap-2 mt-4"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Save className="h-5 w-5" />}
            Criar Receita
          </button>

        </form>
      </div>
    </div>
  );
}