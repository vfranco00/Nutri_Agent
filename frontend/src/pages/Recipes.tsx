import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Recipe } from '../types';
import { ArrowLeft, Plus, Clock, Flame, ChefHat, Trash2, Loader2 } from 'lucide-react';

export function Recipes() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  // Carregar receitas ao abrir
  useEffect(() => {
    async function loadRecipes() {
      try {
        const response = await api.get('/recipes/');
        setRecipes(response.data);
      } catch (error) {
        console.error('Erro ao carregar receitas:', error);
      } finally {
        setLoading(false);
      }
    }
    loadRecipes();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-4">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-6 w-6 text-zinc-400" />
            </button>
            <h1 className="text-2xl font-bold text-green-500">Minhas Receitas</h1>
          </div>
          
          <button 
            onClick={() => navigate('/recipes/new')} // Vamos criar essa rota depois
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Nova Receita
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center mt-20">
            <Loader2 className="animate-spin h-8 w-8 text-green-500" />
          </div>
        )}

        {/* Empty State */}
        {!loading && recipes.length === 0 && (
          <div className="text-center py-20 bg-zinc-900/50 rounded-xl border border-zinc-800 border-dashed">
            <ChefHat className="h-16 w-16 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-zinc-300">Nenhuma receita ainda</h3>
            <p className="text-zinc-500 mt-2">Que tal cadastrar seu prato favorito?</p>
          </div>
        )}

        {/* Grid de Receitas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recipes.map((recipe) => (
            <div key={recipe.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-green-500/30 transition-all cursor-pointer group">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-bold text-zinc-100 group-hover:text-green-400 transition-colors">
                  {recipe.title}
                </h3>
              </div>
              
              <p className="text-zinc-400 text-sm line-clamp-2 mb-4 h-10">
                {recipe.instructions}
              </p>

              <div className="flex items-center gap-4 text-xs text-zinc-500 border-t border-zinc-800 pt-4">
                {recipe.prep_time && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {recipe.prep_time} min
                  </div>
                )}
                {recipe.calories && (
                  <div className="flex items-center gap-1">
                    <Flame className="h-3 w-3" />
                    {recipe.calories} kcal
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}