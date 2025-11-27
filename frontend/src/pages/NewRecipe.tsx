import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { ArrowLeft, Save, Clock, Flame, Type, AlignLeft, Loader2, Plus, Trash2, Carrot } from 'lucide-react';

interface IngredientInput {
  name: string;
  quantity: string;
  unit: string;
}

export function NewRecipe() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Estados
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [calories, setCalories] = useState('');

  // Lista Dinâmica de Ingredientes
  const [ingredients, setIngredients] = useState<IngredientInput[]>([
    { name: '', quantity: '', unit: '' }
  ]);

  function addIngredient() {
    setIngredients([...ingredients, { name: '', quantity: '', unit: '' }]);
  }

  function removeIngredient(index: number) {
    if (ingredients.length === 1) return;
    setIngredients(ingredients.filter((_, i) => i !== index));
  }

  function updateIngredient(index: number, field: keyof IngredientInput, value: string) {
    const newList = [...ingredients];
    newList[index][field] = value;
    setIngredients(newList);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      // Prepara os dados
      const validIngredients = ingredients
        .filter(ing => ing.name.trim() !== '' && ing.quantity !== '')
        .map(ing => ({
          name: ing.name,
          quantity: Number(ing.quantity),
          unit: ing.unit || 'un'
        }));

      await api.post('/recipes/', {
        title,
        instructions,
        prep_time: Number(prepTime) || 0,
        calories: Number(calories) || 0,
        ingredients: validIngredients
      });

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
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/recipes')} className="p-2 hover:bg-zinc-800 rounded-lg">
            <ArrowLeft className="h-6 w-6 text-zinc-400" />
          </button>
          <h1 className="text-2xl font-bold text-green-500">Nova Receita</h1>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Dados Básicos */}
          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Nome do Prato</label>
              <input type="text" required value={title} onChange={e => setTitle(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-green-500" placeholder="Ex: Omelete" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Tempo (min)</label>
                <input type="number" value={prepTime} onChange={e => setPrepTime(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Calorias</label>
                <input type="number" value={calories} onChange={e => setCalories(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
          </div>

          {/* Ingredientes Dinâmicos */}
          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold flex gap-2"><Carrot className="text-orange-500"/> Ingredientes</h2>
              <button type="button" onClick={addIngredient} className="text-green-500 text-sm flex gap-1 items-center hover:text-green-400">
                <Plus className="h-4 w-4"/> Adicionar
              </button>
            </div>
            <div className="space-y-3">
              {ingredients.map((ing, i) => (
                <div key={i} className="flex gap-2">
                  <input placeholder="Nome (ex: Ovo)" value={ing.name} onChange={e => updateIngredient(i, 'name', e.target.value)}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg p-2 outline-none focus:ring-2 focus:ring-green-500" />
                  <input type="number" placeholder="Qtd" value={ing.quantity} onChange={e => updateIngredient(i, 'quantity', e.target.value)}
                    className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg p-2 outline-none focus:ring-2 focus:ring-green-500" />
                  <input placeholder="Un" value={ing.unit} onChange={e => updateIngredient(i, 'unit', e.target.value)}
                    className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg p-2 outline-none focus:ring-2 focus:ring-green-500" />
                  <button type="button" onClick={() => removeIngredient(i)} className="p-2 text-zinc-500 hover:text-red-400">
                    <Trash2 className="h-5 w-5"/>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Preparo e Botão */}
          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 space-y-4">
             <label className="text-sm text-zinc-400">Modo de Preparo</label>
             <textarea required rows={4} value={instructions} onChange={e => setInstructions(e.target.value)}
               className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-green-500" />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-lg flex justify-center gap-2">
            {loading ? <Loader2 className="animate-spin"/> : <Save/>} Criar Receita
          </button>
        </form>
      </div>
    </div>
  );
}