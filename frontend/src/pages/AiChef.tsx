import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { ArrowLeft, ChefHat, Sparkles, Loader2, Save } from 'lucide-react';

export function AiChef() {
  const navigate = useNavigate();
  const [ingredientsInput, setIngredientsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<any>(null);

  async function handleGenerate() {
    if (!ingredientsInput) return;
    setLoading(true);
    try {
      // Converte texto "ovo, batata" em array ["ovo", "batata"]
      const list = ingredientsInput.split(',').map(i => i.trim()).filter(i => i);
      
      const response = await api.post('/ai/recipe-by-ingredients', {
        ingredients: list
      });
      setGeneratedRecipe(response.data);
    } catch (error) {
      alert('Erro ao gerar receita. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveRecipe() {
    if (!generatedRecipe) return;
    try {
      await api.post('/recipes/', generatedRecipe);
      alert('Receita salva com sucesso!');
      navigate('/recipes');
    } catch (error) {
      alert('Erro ao salvar.');
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-zinc-800 rounded-lg">
            <ArrowLeft className="h-6 w-6 text-zinc-400" />
          </button>
          <h1 className="text-2xl font-bold text-orange-500 flex items-center gap-2">
            <ChefHat className="h-8 w-8" /> Chef IA
          </h1>
        </div>

        {/* Input */}
        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 mb-6">
          <label className="block text-sm font-medium text-zinc-400 mb-2">Quais ingredientes você tem?</label>
          <textarea
            value={ingredientsInput}
            onChange={e => setIngredientsInput(e.target.value)}
            placeholder="Ex: Frango, batata doce, creme de leite, cebola..."
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 h-24 focus:ring-2 focus:ring-orange-500 outline-none resize-none"
          />
          <button 
            onClick={handleGenerate}
            disabled={loading || !ingredientsInput}
            className="w-full mt-4 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-lg flex justify-center gap-2 disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 className="animate-spin"/> : <Sparkles className="h-5 w-5"/>} 
            Criar Receita Criativa
          </button>
        </div>

        {/* Resultado */}
        {generatedRecipe && (
          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-700 animate-fadeIn space-y-4">
            <div className="flex justify-between items-start">
              <h2 className="text-xl font-bold text-white">{generatedRecipe.title}</h2>
              <div className="text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-400">
                ~ {generatedRecipe.calories} kcal
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-orange-500 uppercase">Ingredientes</h3>
              <ul className="list-disc list-inside text-zinc-300 text-sm">
                {generatedRecipe.ingredients.map((ing: any, i: number) => (
                  <li key={i}>{ing.quantity}{ing.unit} de {ing.name}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-orange-500 uppercase">Preparo</h3>
              <p className="text-zinc-300 text-sm whitespace-pre-wrap">{generatedRecipe.instructions}</p>
            </div>

            <button 
              onClick={handleSaveRecipe}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg flex justify-center gap-2"
            >
              <Save className="h-5 w-5" /> Salvar na Minha Lista
            </button>
          </div>
        )}

      </div>
    </div>
  );
}