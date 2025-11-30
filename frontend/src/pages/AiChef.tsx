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
      const list = ingredientsInput.split(',').map(i => i.trim()).filter(i => i);
      const response = await api.post('/ai/recipe-by-ingredients', { ingredients: list });
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
    <div className="max-w-3xl mx-auto">
      
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
          <ArrowLeft className="h-6 w-6 text-zinc-500 dark:text-zinc-400" />
        </button>
        <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-500 flex items-center gap-2">
          <ChefHat className="h-8 w-8" /> Chef IA
        </h1>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm mb-6">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-400 mb-2">Quais ingredientes você tem?</label>
        <textarea
          value={ingredientsInput}
          onChange={e => setIngredientsInput(e.target.value)}
          placeholder="Ex: Frango, batata doce, creme de leite, cebola..."
          className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 h-32 focus:ring-2 focus:ring-blue-500 outline-none resize-none dark:text-white"
        />
        <button 
          onClick={handleGenerate}
          disabled={loading || !ingredientsInput}
          className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex justify-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-blue-900/20"
        >
          {loading ? <Loader2 className="animate-spin"/> : <Sparkles className="h-5 w-5"/>} 
          Criar Receita Criativa
        </button>
      </div>

      {generatedRecipe && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 animate-fadeIn space-y-6 shadow-sm">
          <div className="flex justify-between items-start">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{generatedRecipe.title}</h2>
            <div className="text-xs bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
              ~ {generatedRecipe.calories} kcal
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold text-blue-600 dark:text-blue-500 uppercase tracking-wider">Ingredientes</h3>
            <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-300 text-sm space-y-1">
              {generatedRecipe.ingredients.map((ing: any, i: number) => (
                <li key={i}>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{ing.quantity}{ing.unit}</span> de {ing.name}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold text-blue-600 dark:text-blue-500 uppercase tracking-wider">Modo de Preparo</h3>
            <p className="text-zinc-600 dark:text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed bg-zinc-50 dark:bg-zinc-950/50 p-4 rounded-lg border border-zinc-100 dark:border-zinc-800">
              {generatedRecipe.instructions}
            </p>
          </div>

          <button 
            onClick={handleSaveRecipe}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg flex justify-center gap-2 shadow-sm"
          >
            <Save className="h-5 w-5" /> Salvar na Minha Lista
          </button>
        </div>
      )}

    </div>
  );
}