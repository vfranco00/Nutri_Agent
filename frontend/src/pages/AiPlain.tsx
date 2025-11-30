import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { AiPlanResponse, DailyPlan } from '../types';
import { ArrowLeft, Sparkles, Loader2, Target, Zap, Utensils, Lightbulb, Save, Calendar, ShoppingCart } from 'lucide-react';

export function AiPlan() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [planData, setPlanData] = useState<AiPlanResponse | null>(null);
  const [mode, setMode] = useState<1 | 7>(1); // 1 = Diário, 7 = Semanal
  const [selectedDayIndex, setSelectedDayIndex] = useState(0); // Qual dia da semana está vendo
  
  const [savingMealIndex, setSavingMealIndex] = useState<number | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setPlanData(null);
    try {
      const response = await api.post('/ai/generate-plan', { days: mode });
      setPlanData(response.data);
      setSelectedDayIndex(0); // Volta pro dia 1
    } catch (error) {
      alert('Erro ao gerar plano. Verifique seu Perfil!');
      navigate('/profile');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveMeal(mealName: string, suggestion: string, index: number) {
    setSavingMealIndex(index);
    try {
      const aiResponse = await api.post('/ai/recipe-by-ingredients', { ingredients: [suggestion] });
      const fullRecipe = aiResponse.data;
      await api.post('/recipes/', { ...fullRecipe, title: `${mealName}: ${fullRecipe.title}` });
      alert(`Receita salva!`);
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar.');
    } finally {
      setSavingMealIndex(null);
    }
  }

  async function handleCreateShoppingList() {
    if (!planData) return;
    
    const confirmGen = confirm("Deseja gerar uma lista de compras baseada neste cardápio?");
    if (!confirmGen) return;
    
    setLoading(true); // Reusa o loading ou cria um novo se preferir
    try {
      await api.post('/ai/plan-to-shopping-list', planData); // Envia o plano atual
      alert('Lista de compras criada! Verifique na aba "Lista de Compras".');
      navigate('/shopping'); // Redireciona para lá
    } catch (error) {
      alert('Erro ao criar lista.');
    } finally {
      setLoading(false);
    }
  }

  // Pega o plano do dia selecionado
  const currentDay: DailyPlan | undefined = planData?.days[selectedDayIndex];

  return (
    <div className="max-w-5xl mx-auto">
      
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
          <ArrowLeft className="h-6 w-6 text-zinc-500 dark:text-zinc-400" />
        </button>
        <h1 className="text-2xl font-bold text-purple-500 flex items-center gap-2">
          <Sparkles className="h-6 w-6" /> NutriAgent AI
        </h1>
      </div>

      {!planData && !loading && (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 border-dashed text-center px-4 shadow-sm">
          <div className="bg-purple-100 dark:bg-purple-500/10 p-4 rounded-full mb-6">
            <Calendar className="h-12 w-12 text-purple-600 dark:text-purple-500" />
          </div>
          <h2 className="text-2xl font-bold dark:text-white mb-4">Escolha seu Planejamento</h2>
          
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg mb-8">
            <button 
              onClick={() => setMode(1)}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${mode === 1 ? 'bg-white dark:bg-zinc-700 shadow text-purple-600 dark:text-white' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900'}`}
            >
              Diário (Rápido)
            </button>
            <button 
              onClick={() => setMode(7)}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${mode === 7 ? 'bg-white dark:bg-zinc-700 shadow text-purple-600 dark:text-white' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900'}`}
            >
              Semanal (Completo)
            </button>
          </div>

          <button 
            onClick={handleGenerate}
            className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-purple-900/20 transition-all hover:scale-105 flex items-center gap-2"
          >
            <Zap className="h-5 w-5 fill-current" />
            {mode === 1 ? 'Gerar Dia' : 'Gerar Semana'}
          </button>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <Loader2 className="h-12 w-12 text-purple-500 animate-spin" />
          <p className="text-zinc-500 dark:text-zinc-400 animate-pulse">
            {mode === 7 ? "Criando estratégia para 7 dias..." : "Calculando macros do dia..."}
          </p>
        </div>
      )}

      {planData && currentDay && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Navegação por Dias (Só aparece se for Semanal) */}
          {planData.days.length > 1 && (
            <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
              {planData.days.map((day, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedDayIndex(idx)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold border transition-colors whitespace-nowrap
                    ${selectedDayIndex === idx 
                      ? 'bg-purple-600 border-purple-600 text-white' 
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-purple-500'}`}
                >
                  {day.day}
                </button>
              ))}
            </div>
          )}

          {/* Cabeçalho do Dia */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-500" />
              {currentDay.day}
            </h2>
            {planData.days.length > 1 && (
               <span className="text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                 Dia {selectedDayIndex + 1} de 7
               </span>
            )}
          </div>
          
          {/* Macros */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center border-l-4 border-l-red-500 shadow-sm">
              <Target className="h-6 w-6 text-red-500 mb-2" />
              <span className="text-2xl font-bold dark:text-white">{currentDay.calories_target}</span>
              <span className="text-xs text-zinc-500 uppercase tracking-wider">Kcal</span>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center shadow-sm">
              <span className="text-xl font-bold text-blue-500">{currentDay.macros.protein}</span>
              <span className="text-xs text-zinc-500 uppercase">Proteína</span>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center shadow-sm">
              <span className="text-xl font-bold text-yellow-500">{currentDay.macros.carbs}</span>
              <span className="text-xs text-zinc-500 uppercase">Carbo</span>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center shadow-sm">
              <span className="text-xl font-bold text-orange-500">{currentDay.macros.fats}</span>
              <span className="text-xs text-zinc-500 uppercase">Gordura</span>
            </div>
          </div>

          {/* Refeições */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/30">
              <h3 className="font-semibold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
                <Utensils className="h-5 w-5 text-purple-500" /> Cardápio Sugerido
              </h3>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {currentDay.meals.map((meal, idx) => (
                <div key={idx} className="p-6 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors flex flex-col md:flex-row gap-4 justify-between items-start">
                  <div>
                    <h4 className="text-purple-600 dark:text-purple-400 font-bold mb-2 text-sm uppercase tracking-wide">{meal.name}</h4>
                    <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed text-sm">{meal.suggestion}</p>
                  </div>
                  <button 
                    onClick={() => handleSaveMeal(meal.name, meal.suggestion, idx)}
                    disabled={savingMealIndex === idx}
                    className="shrink-0 flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-green-600 hover:text-white text-zinc-500 dark:text-zinc-400 px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                  >
                    {savingMealIndex === idx ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {savingMealIndex === idx ? 'Salvando...' : 'Salvar Receita'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 p-6 rounded-xl flex gap-4 items-start">
            <Lightbulb className="h-6 w-6 text-purple-500 dark:text-purple-400 shrink-0 mt-1" />
            <div>
              <h4 className="font-bold text-purple-700 dark:text-purple-400 mb-1">Dica do NutriAgent</h4>
              <p className="text-purple-700/80 dark:text-purple-200/80 text-sm italic">"{currentDay.tip}"</p>
            </div>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={handleCreateShoppingList}
              className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-pink-900/20"
            >
              <ShoppingCart className="h-5 w-5" /> Gerar Lista de Compras
            </button>

            <button 
              onClick={() => setPlanData(null)} 
              className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 py-3 rounded-lg transition-colors"
            >
              Gerar Novo Plano
            </button>
            
          </div>
        </div>
      )}

    </div>
  );
}