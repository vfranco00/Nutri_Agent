import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Recipe } from '../types';
import { CATEGORIES } from '../types';
import { Plus, Clock, Flame, ChefHat, Trash2, Loader2, X, Edit2, Save, AlertCircle, Carrot, Settings2, Volume2, Square, Star, Filter } from 'lucide-react';

function cleanMarkdown(md?: string) {
  if (!md) return '';
  return md
    .replace(/!\[.*?\]\(.*?\)/g, '') // remove images
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // convert links to text
    .replace(/(^|\s)[#>*\-+`~]{1,}/g, '') // remove common markdown symbols
    .replace(/<\/?[^>]+(>|$)/g, '') // strip HTML tags
    .replace(/\r\n|\r/g, '\n') // normalize newlines
    .trim();
}

interface EditFormData {
  title: string;
  instructions: string;
  prep_time: number;
  calories: number;
  preparation_method: string;
  category: string;
}

export function Recipes() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // Estado do filtro
  
  // Estados do Modal
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditFormData>({
    title: '', instructions: '', prep_time: 0, calories: 0, preparation_method: '', category: 'almoco'
  });

  const [isSpeaking, setIsSpeaking] = useState(false);

  async function loadRecipes() {
    try {
      const response = await api.get('/recipes/');
      setRecipes(response.data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }

  useEffect(() => { loadRecipes(); }, []);

  useEffect(() => {
    if (!selectedRecipe) { window.speechSynthesis.cancel(); setIsSpeaking(false); }
  }, [selectedRecipe]);

  // Lógica de Favoritar
  async function toggleFavorite(e: React.MouseEvent, recipe: Recipe) {
    e.stopPropagation(); // Evita abrir o modal ao clicar na estrela
    try {
      // Atualiza visualmente na hora (Optimistic UI)
      const updatedList = recipes.map(r => 
        r.id === recipe.id ? { ...r, is_favorite: !r.is_favorite } : r
      );
      setRecipes(updatedList);

      // Manda pro backend (usando o endpoint de update que já criamos)
      await api.put(`/recipes/${recipe.id}`, { 
        ...recipe, 
        is_favorite: !recipe.is_favorite 
      });
    } catch (error) {
      alert('Erro ao favoritar.');
      loadRecipes(); // Reverte em caso de erro
    }
  }

  function handleOpenRecipe(recipe: Recipe) {
    setSelectedRecipe(recipe);
    setEditForm({
      title: recipe.title,
      instructions: recipe.instructions,
      prep_time: recipe.prep_time || 0,
      calories: recipe.calories || 0,
      // @ts-ignore
      preparation_method: recipe.preparation_method || 'fogao',
      category: recipe.category || 'almoco'
    });
    setIsEditing(false);
  }

  function handleCloseModal() { setSelectedRecipe(null); setIsEditing(false); }

  function handleSpeak() {
    if (!selectedRecipe) return;
    if (isSpeaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); return; }

    const ingredientsText = selectedRecipe.ingredients?.map(i => `${i.quantity} ${i.unit} de ${i.name}`).join('. ');
    const cleanInstructions = cleanMarkdown(selectedRecipe.instructions);
    const textToRead = `Receita: ${selectedRecipe.title}. Tempo: ${selectedRecipe.prep_time} minutos. Ingredientes: ${ingredientsText || 'Não informados'}. Preparo: ${cleanInstructions}`;

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = 'pt-BR';
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }

  async function handleDelete(id: number) {
    if (confirm('Tem certeza?')) {
      try {
        await api.delete(`/recipes/${id}`);
        setRecipes(recipes.filter(r => r.id !== id));
        handleCloseModal();
      } catch (error) { alert('Erro ao excluir.'); }
    }
  }

  async function handleSaveEdit() {
    if (!selectedRecipe) return;
    try {
      const res = await api.put(`/recipes/${selectedRecipe.id}`, editForm);
      const updatedRecipe = res.data;
      setRecipes(recipes.map(r => r.id === selectedRecipe.id ? updatedRecipe : r));
      setSelectedRecipe(updatedRecipe);
      setIsEditing(false);
      alert('Receita atualizada!');
    } catch (error) { alert('Erro ao atualizar.'); }
  }

  // Filtragem
  const filteredRecipes = filter === 'all' 
    ? recipes 
    : recipes.filter(r => r.category === filter);

  // Ordena favoritos primeiro
  const sortedRecipes = [...filteredRecipes].sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0));

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <h1 className="text-2xl font-bold text-orange-500">Minhas Receitas</h1>
        
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          {Object.entries(CATEGORIES).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap
                ${filter === key 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:border-orange-500'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <button onClick={() => navigate('/recipes/new')} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm shrink-0">
          <Plus className="h-5 w-5" /> <span className="hidden md:inline">Nova Receita</span>
        </button>
      </div>

      {loading && <div className="flex justify-center mt-20"><Loader2 className="animate-spin h-8 w-8 text-orange-500" /></div>}

      {!loading && sortedRecipes.length === 0 && (
        <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 border-dashed">
          <ChefHat className="h-16 w-16 text-zinc-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold dark:text-zinc-300">Nenhuma receita encontrada</h3>
          <p className="text-zinc-500 mt-2">Mude o filtro ou cadastre uma nova.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedRecipes.map((recipe) => (
          <div key={recipe.id} onClick={() => handleOpenRecipe(recipe)} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-orange-500/50 hover:-translate-y-1 transition-all cursor-pointer group shadow-sm relative">
            
            {/* Botão de Favorito (Absoluto no topo direito) */}
            <button 
              onClick={(e) => toggleFavorite(e, recipe)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors z-10"
            >
              <Star className={`h-5 w-5 ${recipe.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-400'}`} />
            </button>

            <div className="flex justify-between items-start mb-3 pr-8">
              <h3 className="text-lg font-bold dark:text-zinc-100 group-hover:text-orange-500 transition-colors line-clamp-1">
                {recipe.title}
              </h3>
            </div>
            
            <p className="text-zinc-500 dark:text-zinc-400 text-sm line-clamp-3 mb-4 h-12">
              {cleanMarkdown(recipe.instructions)}
            </p>

            <div className="flex items-center gap-4 text-xs text-zinc-400 border-t border-zinc-100 dark:border-zinc-800 pt-4">
              <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{recipe.prep_time}m</div>
              <div className="flex items-center gap-1"><Flame className="h-3 w-3" />{Math.round(recipe.calories || 0)}kcal</div>
              {recipe.category && <div className="ml-auto px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500 capitalize">{recipe.category}</div>}
            </div>
          </div>
        ))}
      </div>

      {selectedRecipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-zinc-200 dark:border-zinc-800">
            
            <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
              {isEditing ? (
                <input value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} className="bg-zinc-100 dark:bg-zinc-800 text-xl font-bold dark:text-white rounded px-2 py-1 w-full mr-4 outline-none focus:ring-2 focus:ring-orange-500" />
              ) : (
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold dark:text-white">{selectedRecipe.title}</h2>
                  <button onClick={handleSpeak} className={`p-2 rounded-full transition-colors ${isSpeaking ? 'bg-orange-500 text-white animate-pulse' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-orange-500'}`}>
                    {isSpeaking ? <Square className="h-4 w-4 fill-current" /> : <Volume2 className="h-5 w-5" />}
                  </button>
                </div>
              )}
              <button onClick={handleCloseModal} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400"><X className="h-6 w-6" /></button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              
              <div className="flex flex-wrap gap-4">
                {/* Inputs de Métricas... (Mantidos) */}
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <Clock className="h-4 w-4 text-blue-500" />
                  {isEditing ? <input type="number" className="w-16 bg-transparent outline-none border-b border-zinc-300 dark:border-zinc-700" value={editForm.prep_time} onChange={e => setEditForm({...editForm, prep_time: Number(e.target.value)})} /> : <span>{selectedRecipe.prep_time} min</span>}
                </div>
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <Flame className="h-4 w-4 text-orange-500" />
                  {isEditing ? <input type="number" className="w-16 bg-transparent outline-none border-b border-zinc-300 dark:border-zinc-700" value={editForm.calories} onChange={e => setEditForm({...editForm, calories: Number(e.target.value)})} /> : <span>{Math.round(selectedRecipe.calories || 0)} kcal</span>}
                </div>
                
                {/* Seletor de Categoria (NOVO NO EDIT) */}
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <Filter className="h-4 w-4 text-green-500" />
                  {isEditing ? (
                    <select value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} className="bg-transparent outline-none border-b border-zinc-300 dark:border-zinc-700 text-sm">
                      {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  ) : <span className="capitalize">{CATEGORIES[selectedRecipe.category as keyof typeof CATEGORIES] || selectedRecipe.category}</span>}
                </div>

                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <Settings2 className="h-4 w-4 text-purple-500" />
                  {isEditing ? (
                    <select value={editForm.preparation_method} onChange={e => setEditForm({...editForm, preparation_method: e.target.value})} className="bg-transparent outline-none border-b border-zinc-300 dark:border-zinc-700 text-sm">
                      <option value="fogao">Fogão</option><option value="forno">Forno</option><option value="airfryer">Airfryer</option><option value="microondas">Microondas</option><option value="cru">Cru</option>
                    </select>
                  ) : <span className="capitalize">{selectedRecipe.preparation_method || 'Fogão'}</span>}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-bold text-orange-500 uppercase tracking-wider flex items-center gap-2"><Carrot className="h-4 w-4" /> Ingredientes</h3>
                {selectedRecipe.ingredients && selectedRecipe.ingredients.length > 0 ? (
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedRecipe.ingredients.map((ing) => (
                      <li key={ing.id} className="text-zinc-700 dark:text-zinc-300 text-sm bg-zinc-50 dark:bg-zinc-950/50 p-2 rounded border border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                        <span>{ing.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-400">{ing.calories ? `~${Math.round(ing.calories)}kcal` : ''}</span>
                          <span className="font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-200 dark:bg-zinc-800 px-2 rounded">{ing.quantity} {ing.unit}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-zinc-500 text-sm italic">Nenhum ingrediente cadastrado.</p>}
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-bold text-orange-500 uppercase tracking-wider">Modo de Preparo</h3>
                {isEditing ? (
                  <textarea rows={8} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 dark:text-zinc-300 outline-none resize-none focus:ring-2 focus:ring-orange-500" value={editForm.instructions} onChange={e => setEditForm({...editForm, instructions: e.target.value})} />
                ) : (
                  <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">{cleanMarkdown(selectedRecipe.instructions)}</p>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 rounded-b-2xl flex justify-between">
              {isEditing ? (
                <>
                  <button onClick={() => setIsEditing(false)} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-white px-4 py-2 font-medium">Cancelar</button>
                  <button onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"><Save className="h-4 w-4" /> Salvar</button>
                </>
              ) : (
                <>
                  <button onClick={() => handleDelete(selectedRecipe.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 px-4 py-2 rounded-lg flex items-center gap-2"><Trash2 className="h-4 w-4" /> Excluir</button>
                  <button onClick={() => setIsEditing(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"><Edit2 className="h-4 w-4" /> Editar</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}