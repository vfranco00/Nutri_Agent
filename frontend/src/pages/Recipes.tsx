import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Recipe } from '../types';
import { Plus, Clock, Flame, ChefHat, Trash2, Loader2, X, Edit2, Save, AlertCircle, Carrot, Settings2, ArrowLeft, Square, Volume2 } from 'lucide-react';

interface EditFormData {
  title: string;
  instructions: string;
  prep_time: number;
  calories: number;
  preparation_method: string;
}

export function Recipes() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Estados do Modal
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditFormData>({
    title: '', instructions: '', prep_time: 0, calories: 0, preparation_method: ''
  });


  async function loadRecipes() {
    try {
      const response = await api.get('/recipes/');
      setRecipes(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecipes();
  }, []);

  function handleOpenRecipe(recipe: Recipe) {
    setSelectedRecipe(recipe);
    setEditForm({
      title: recipe.title,
      instructions: recipe.instructions,
      prep_time: recipe.prep_time || 0,
      calories: recipe.calories || 0,
      // @ts-ignore - Caso o campo não venha do back ainda
      preparation_method: recipe.preparation_method || 'fogao'
    });
    setIsEditing(false);
  }

  function handleCloseModal() {
    setSelectedRecipe(null);
    setIsEditing(false);
  }

  function handleSpeak() {
    if (!selectedRecipe) return;

    // Se já estiver falando, para.
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    // Monta o texto para leitura
    // @ts-ignore
    const ingredientsText = selectedRecipe.ingredients?.map(i => `${i.quantity} ${i.unit} de ${i.name}`).join('. ');
    
    const textToRead = `
      Receita: ${selectedRecipe.title}.
      Tempo de preparo: ${selectedRecipe.prep_time} minutos.
      
      Ingredientes: ${ingredientsText || 'Não informados'}.
      
      Modo de Preparo: ${selectedRecipe.instructions}
    `;

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = 'pt-BR'; // Força português do Brasil
    utterance.rate = 1.0; // Velocidade normal
    
    utterance.onend = () => setIsSpeaking(false); // Quando acabar, reseta o ícone
    
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }

  async function handleDelete(id: number) {
    if (confirm('Tem certeza que deseja excluir esta receita?')) {
      try {
        await api.delete(`/recipes/${id}`);
        setRecipes(recipes.filter(r => r.id !== id));
        handleCloseModal();
      } catch (error) {
        alert('Erro ao excluir.');
      }
    }
  }

  async function handleSaveEdit() {
    if (!selectedRecipe) return;
    try {
      const res = await api.put(`/recipes/${selectedRecipe.id}`, editForm);
      
      // Atualiza a lista e o modal com os dados novos
      const updatedRecipe = res.data;
      setRecipes(recipes.map(r => r.id === selectedRecipe.id ? updatedRecipe : r));
      setSelectedRecipe(updatedRecipe);
      setIsEditing(false);
      alert('Receita atualizada!');
    } catch (error) {
      alert('Erro ao atualizar.');
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-8">

        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <ArrowLeft className="h-6 w-6 text-zinc-400" />
          </button>
          <h1 className="text-2xl font-bold text-orange-500 mb-6 flex items-center gap-2">
            <ChefHat className="h-6 w-6" /> Minhas Receitas
          </h1>
        </div>


        <button 
          onClick={() => navigate('/recipes/new')}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="h-5 w-5" /> Nova Receita
        </button>
      </div>

      {loading && (
        <div className="flex justify-center mt-20">
          <Loader2 className="animate-spin h-8 w-8 text-orange-500" />
        </div>
      )}

      {!loading && recipes.length === 0 && (
        <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 border-dashed">
          <ChefHat className="h-16 w-16 text-zinc-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold dark:text-zinc-300">Nenhuma receita ainda</h3>
          <p className="text-zinc-500 mt-2">Que tal cadastrar seu prato favorito?</p>
        </div>
      )}

      {/* Grid de Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recipes.map((recipe) => (
          <div 
            key={recipe.id} 
            onClick={() => handleOpenRecipe(recipe)}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-orange-500/50 hover:-translate-y-1 transition-all cursor-pointer group shadow-sm"
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-bold dark:text-zinc-100 group-hover:text-orange-500 transition-colors line-clamp-1">
                {recipe.title}
              </h3>
            </div>
            
            <p className="text-zinc-500 dark:text-zinc-400 text-sm line-clamp-3 mb-4 h-12">
              {recipe.instructions}
            </p>

            <div className="flex items-center gap-4 text-xs text-zinc-400 border-t border-zinc-100 dark:border-zinc-800 pt-4">
              {recipe.prep_time && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {recipe.prep_time} min
                </div>
              )}
              {recipe.calories && (
                <div className="flex items-center gap-1">
                  <Flame className="h-3 w-3" />
                  {Math.round(recipe.calories)} kcal
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* --- MODAL DE DETALHES --- */}
      {selectedRecipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-zinc-200 dark:border-zinc-800">
            
            {/* Header Modal */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
              {isEditing ? (
                <input 
                  value={editForm.title} 
                  onChange={e => setEditForm({...editForm, title: e.target.value})}
                  className="bg-zinc-100 dark:bg-zinc-800 text-xl font-bold dark:text-white rounded px-2 py-1 w-full mr-4 outline-none focus:ring-2 focus:ring-orange-500"
                />
              ) : (
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold dark:text-white">{selectedRecipe.title}</h2>
                  
                  {/* BOTÃO DE OUVIR 🔊 */}
                  <button 
                    onClick={handleSpeak}
                    className={`p-2 rounded-full transition-colors ${isSpeaking ? 'bg-orange-500 text-white animate-pulse' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-orange-500'}`}
                    title={isSpeaking ? "Parar leitura" : "Ouvir receita"}
                  >
                    {isSpeaking ? <Square className="h-4 w-4 fill-current" /> : <Volume2 className="h-5 w-5" />}
                  </button>
                </div>
              )}
              <button onClick={handleCloseModal} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400 transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Corpo Modal */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Métricas e Método */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <Clock className="h-4 w-4 text-blue-500" />
                  {isEditing ? <input type="number" className="w-16 bg-transparent outline-none border-b border-zinc-300 dark:border-zinc-700" value={editForm.prep_time} onChange={e => setEditForm({...editForm, prep_time: Number(e.target.value)})} /> : <span>{selectedRecipe.prep_time} min</span>}
                </div>
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <Flame className="h-4 w-4 text-orange-500" />
                  {isEditing ? <input type="number" className="w-16 bg-transparent outline-none border-b border-zinc-300 dark:border-zinc-700" value={editForm.calories} onChange={e => setEditForm({...editForm, calories: Number(e.target.value)})} /> : <span>{Math.round(selectedRecipe.calories || 0)} kcal</span>}
                </div>
                {/* Método de Preparo */}
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <Settings2 className="h-4 w-4 text-purple-500" />
                  {isEditing ? (
                    <select 
                      value={editForm.preparation_method} 
                      onChange={e => setEditForm({...editForm, preparation_method: e.target.value})}
                      className="bg-transparent outline-none border-b border-zinc-300 dark:border-zinc-700 text-sm"
                    >
                      <option value="fogao">Fogão</option>
                      <option value="forno">Forno</option>
                      <option value="airfryer">Airfryer</option>
                      <option value="microondas">Microondas</option>
                      <option value="cru">Cru</option>
                    </select>
                  ) : (
                    <span className="capitalize">
                      {/* @ts-ignore */}
                      {selectedRecipe.preparation_method || 'Fogão'}
                    </span>
                  )}
                </div>
              </div>

              {/* Lista de Ingredientes (Nova Seção) */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-orange-500 uppercase tracking-wider flex items-center gap-2">
                  <Carrot className="h-4 w-4" /> Ingredientes
                </h3>
                {/* @ts-ignore - Verificação de segurança caso não venha do back */}
                {selectedRecipe.ingredients && selectedRecipe.ingredients.length > 0 ? (
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {/* @ts-ignore */}
                    {selectedRecipe.ingredients.map((ing) => (
                      <li key={ing.id} className="text-zinc-700 dark:text-zinc-300 text-sm bg-zinc-50 dark:bg-zinc-950/50 p-2 rounded border border-zinc-100 dark:border-zinc-800 flex justify-between">
                        <span>{ing.name}</span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{ing.quantity} {ing.unit}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-zinc-500 text-sm italic">Nenhum ingrediente cadastrado.</p>
                )}
              </div>

              {/* Modo de Preparo */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-orange-500 uppercase tracking-wider">Modo de Preparo</h3>
                {isEditing ? (
                  <textarea 
                    rows={8}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 dark:text-zinc-300 outline-none resize-none focus:ring-2 focus:ring-orange-500"
                    value={editForm.instructions} 
                    onChange={e => setEditForm({...editForm, instructions: e.target.value})}
                  />
                ) : (
                  <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {selectedRecipe.instructions}
                  </p>
                )}
              </div>

              {!isEditing && (
                <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 p-4 rounded-lg flex gap-3 items-start">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                  <p className="text-yellow-700 dark:text-yellow-200/70 text-sm">
                    Para alterar os ingredientes, por favor crie uma nova receita.
                  </p>
                </div>
              )}

            </div>

            {/* Footer Ações */}
            <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 rounded-b-2xl flex justify-between">
              
              {isEditing ? (
                <>
                  <button onClick={() => setIsEditing(false)} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-white px-4 py-2 font-medium">
                    Cancelar
                  </button>
                  <button onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2">
                    <Save className="h-4 w-4" /> Salvar Alterações
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => handleDelete(selectedRecipe.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
                    <Trash2 className="h-4 w-4" /> Excluir
                  </button>
                  <button onClick={() => setIsEditing(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm">
                    <Edit2 className="h-4 w-4" /> Editar
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
}