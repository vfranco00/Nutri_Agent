import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Recipe } from '../types';
import { ArrowLeft, Plus, Clock, Flame, ChefHat, Trash2, Loader2, X, Edit2, Save, AlertCircle } from 'lucide-react';

// Interface para o formulário de edição (apenas campos editáveis simples)
interface EditFormData {
  title: string;
  instructions: string;
  prep_time: number;
  calories: number;
}

export function Recipes() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados do Modal
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditFormData>({
    title: '', instructions: '', prep_time: 0, calories: 0
  });

  // Carregar receitas
  async function loadRecipes() {
    try {
      const response = await api.get('/recipes/');
      setRecipes(response.data);
    } catch (error) {
      console.error('Erro ao carregar:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecipes();
  }, []);

  // Abrir Modal
  function handleOpenRecipe(recipe: Recipe) {
    setSelectedRecipe(recipe);
    setEditForm({
      title: recipe.title,
      instructions: recipe.instructions,
      prep_time: recipe.prep_time || 0,
      calories: recipe.calories || 0
    });
    setIsEditing(false); // Sempre começa em modo visualização
  }

  // Fechar Modal
  function handleCloseModal() {
    setSelectedRecipe(null);
    setIsEditing(false);
  }

  // Deletar Receita
  async function handleDelete(id: number) {
    if (confirm('Tem certeza que deseja excluir esta receita?')) {
      try {
        await api.delete(`/recipes/${id}`);
        // Atualiza a lista local removendo o item
        setRecipes(recipes.filter(r => r.id !== id));
        handleCloseModal();
      } catch (error) {
        alert('Erro ao excluir receita.');
      }
    }
  }

  // Salvar Edição
  async function handleSaveEdit() {
    if (!selectedRecipe) return;
    try {
      // Manda pro backend
      const res = await api.put(`/recipes/${selectedRecipe.id}`, editForm);
      
      // Atualiza a lista local com os dados novos
      const updatedList = recipes.map(r => r.id === selectedRecipe.id ? res.data : r);
      setRecipes(updatedList);
      
      // Atualiza o modal
      setSelectedRecipe(res.data);
      setIsEditing(false);
      alert('Receita atualizada!');
    } catch (error) {
      alert('Erro ao atualizar receita.');
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-4">
      <div className="max-w-5xl mx-auto">
        
        {/* Header da Página */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
              <ArrowLeft className="h-6 w-6 text-zinc-400" />
            </button>
            <h1 className="text-2xl font-bold text-green-500">Minhas Receitas</h1>
          </div>
          <button onClick={() => navigate('/recipes/new')} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-lg shadow-green-900/20">
            <Plus className="h-5 w-5" /> Nova Receita
          </button>
        </div>

        {/* Loading / Empty States */}
        {loading && <div className="flex justify-center mt-20"><Loader2 className="animate-spin h-8 w-8 text-green-500" /></div>}
        {!loading && recipes.length === 0 && (
          <div className="text-center py-20 bg-zinc-900/50 rounded-xl border border-zinc-800 border-dashed">
            <ChefHat className="h-16 w-16 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-zinc-300">Nenhuma receita ainda</h3>
          </div>
        )}

        {/* Grid de Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map((recipe) => (
            <div 
              key={recipe.id} 
              onClick={() => handleOpenRecipe(recipe)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-green-500/50 hover:-translate-y-1 transition-all cursor-pointer group shadow-lg hover:shadow-green-900/10"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-bold text-zinc-100 group-hover:text-green-400 transition-colors line-clamp-1">
                  {recipe.title}
                </h3>
              </div>
              <p className="text-zinc-400 text-sm line-clamp-3 mb-4 h-12">
                {recipe.instructions}
              </p>
              <div className="flex items-center gap-4 text-xs text-zinc-500 border-t border-zinc-800 pt-4">
                {recipe.prep_time && <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{recipe.prep_time} min</div>}
                {recipe.calories && <div className="flex items-center gap-1"><Flame className="h-3 w-3" />{Math.round(recipe.calories)} kcal</div>}
              </div>
            </div>
          ))}
        </div>

        {/* --- MODAL (POP-UP) --- */}
        {selectedRecipe && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-zinc-900 w-full max-w-2xl rounded-2xl border border-zinc-800 shadow-2xl flex flex-col max-h-[90vh]">
              
              {/* Header do Modal */}
              <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                {isEditing ? (
                  <input 
                    value={editForm.title} 
                    onChange={e => setEditForm({...editForm, title: e.target.value})}
                    className="bg-zinc-800 text-xl font-bold text-white rounded px-2 py-1 w-full mr-4 outline-none focus:ring-2 focus:ring-green-500"
                  />
                ) : (
                  <h2 className="text-2xl font-bold text-white">{selectedRecipe.title}</h2>
                )}
                <button onClick={handleCloseModal} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors">
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Corpo do Modal (Scrollável) */}
              <div className="p-6 overflow-y-auto space-y-6">
                
                {/* Métricas */}
                <div className="flex gap-4">
                  <div className="flex items-center gap-2 text-zinc-400 bg-zinc-950/50 px-3 py-2 rounded-lg border border-zinc-800">
                    <Clock className="h-4 w-4 text-blue-500" />
                    {isEditing ? (
                      <input type="number" className="w-16 bg-transparent outline-none border-b border-zinc-700 focus:border-blue-500 text-white" 
                        value={editForm.prep_time} onChange={e => setEditForm({...editForm, prep_time: Number(e.target.value)})} />
                    ) : (
                      <span>{selectedRecipe.prep_time} min</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400 bg-zinc-950/50 px-3 py-2 rounded-lg border border-zinc-800">
                    <Flame className="h-4 w-4 text-orange-500" />
                    {isEditing ? (
                      <input type="number" className="w-16 bg-transparent outline-none border-b border-zinc-700 focus:border-orange-500 text-white" 
                        value={editForm.calories} onChange={e => setEditForm({...editForm, calories: Number(e.target.value)})} />
                    ) : (
                      <span>{Math.round(selectedRecipe.calories || 0)} kcal</span>
                    )}
                  </div>
                </div>

                {/* Modo de Preparo */}
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-green-500 uppercase tracking-wider">Modo de Preparo</h3>
                  {isEditing ? (
                    <textarea 
                      rows={8}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-zinc-300 focus:ring-2 focus:ring-green-500 outline-none resize-none"
                      value={editForm.instructions} 
                      onChange={e => setEditForm({...editForm, instructions: e.target.value})}
                    />
                  ) : (
                    <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{selectedRecipe.instructions}</p>
                  )}
                </div>

                {!isEditing && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg flex gap-3 items-start">
                    <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                    <p className="text-yellow-200/70 text-sm">
                      Para alterar os ingredientes, por favor crie uma nova receita. A edição de ingredientes complexos estará disponível em breve.
                    </p>
                  </div>
                )}

              </div>

              {/* Footer (Ações) */}
              <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 rounded-b-2xl flex justify-between items-center">
                
                {isEditing ? (
                  <>
                    <button onClick={() => setIsEditing(false)} className="text-zinc-400 hover:text-white px-4 py-2 font-medium">
                      Cancelar
                    </button>
                    <button onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2">
                      <Save className="h-4 w-4" /> Salvar Alterações
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => handleDelete(selectedRecipe.id)} className="text-red-500 hover:bg-red-500/10 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
                      <Trash2 className="h-4 w-4" /> Excluir
                    </button>
                    <button onClick={() => setIsEditing(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all">
                      <Edit2 className="h-4 w-4" /> Editar
                    </button>
                  </>
                )}
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}