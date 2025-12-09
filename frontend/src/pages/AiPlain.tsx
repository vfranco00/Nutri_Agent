import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { AiPlanResponse, DailyPlan } from '../types';
import { ArrowLeft, Sparkles, Loader2, Target, Zap, Utensils, Lightbulb, Save, Calendar, Repeat, Shuffle, ShoppingCart } from 'lucide-react';

export function AiPlan() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [planData, setPlanData] = useState<AiPlanResponse | null>(null);
  
  // --- CONFIGURAÇÕES DO PLANO ---
  const [mode, setMode] = useState<1 | 7>(1); // 1 Dia ou 7 Dias
  const [variety, setVariety] = useState<'varied' | 'repetitive'>('varied'); // Variedade vs Praticidade
  const [mealsCount, setMealsCount] = useState(3); // Quantidade de refeições (Padrão 3)
  
  // --- ESTADOS DE NAVEGAÇÃO E AÇÃO ---
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [savingMealIndex, setSavingMealIndex] = useState<number | null>(null); // Qual botão está carregando

  // 1. GERAR CARDÁPIO
  async function handleGenerate() {
    setLoading(true);
    setPlanData(null);
    try {
      // Envia todas as configurações para a IA
      const response = await api.post('/ai/generate-plan', { 
        days: mode,
        variety: variety,
        meals_count: mealsCount
      });
      setPlanData(response.data);
      setSelectedDayIndex(0); // Volta para o dia 1 ao gerar
    } catch (error) {
      console.error(error);
      alert('Erro ao gerar plano. Verifique se seu perfil está completo.');
      navigate('/profile');
    } finally {
      setLoading(false);
    }
  }

  // 2. SALVAR REFEIÇÃO COMO RECEITA
  async function handleSaveMeal(mealName: string, suggestion: string, index: number) {
    setSavingMealIndex(index);
    try {
      // Pede pra IA criar a receita completa baseada na sugestão do cardápio
      const aiResponse = await api.post('/ai/recipe-by-ingredients', { ingredients: [suggestion] });
      const fullRecipe = aiResponse.data;
      
      // Salva no banco de receitas
      await api.post('/recipes/', { 
        ...fullRecipe, 
        title: `${mealName}: ${fullRecipe.title}`,
        category: getCategoryFromMealName(mealName) // Tenta adivinhar a categoria
      });
      
      alert(`Receita salva com sucesso!`);
    } catch (error) {
      alert('Erro ao salvar receita.');
    } finally {
      setSavingMealIndex(null);
    }
  }

  // Helper para categorizar ao salvar
  function getCategoryFromMealName(name: string) {
    const n = name.toLowerCase();
    if (n.includes('café') || n.includes('lanche')) return 'lanche';
    if (n.includes('almoço')) return 'almoco';
    if (n.includes('jantar')) return 'jantar';
    return 'almoco';
  }

  // 3. GERAR LISTA DE COMPRAS
  async function handleCreateShoppingList() {
    if (!planData) return;
    
    const confirmGen = confirm("Deseja gerar uma lista de compras baseada neste cardápio completo?");
    if (!confirmGen) return;

    setLoading(true);
    try {
      await api.post('/ai/plan-to-shopping-list', planData);
      alert('Lista de compras criada! Redirecionando...');
      navigate('/shopping');
    } catch (error) {
      alert('Erro ao criar lista de compras.');
    } finally {
      setLoading(false);
    }
  }

  // Dados do dia selecionado
  const currentDay: DailyPlan | undefined = planData?.days[selectedDayIndex];

  return (
    <div className="max-w-5xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
          <ArrowLeft className="h-6 w-6 text-zinc-500 dark:text-zinc-400" />
        </button>
        <h1 className="text-2xl font-bold text-purple-500 flex items-center gap-2">
          <Sparkles className="h-6 w-6" /> NutriAgent AI
        </h1>
      </div>

      {/* --- TELA DE CONFIGURAÇÃO (Se não tiver plano gerado) --- */}
      {!planData && !loading && (
        <div className="flex flex-col items-center justify-center py-10 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 border-dashed text-center px-4 shadow-sm">
          
          <div className="bg-purple-100 dark:bg-purple-500/10 p-4 rounded-full mb-6">
            <Calendar className="h-10 w-10 text-purple-600 dark:text-purple-500" />
          </div>
          
          <h2 className="text-2xl font-bold dark:text-white mb-6">Configure seu Plano</h2>
          
          <div className="w-full max-w-md space-y-8">
            
            {/* Opção 1: Duração */}
            <div>
              <label className="text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-3 block uppercase tracking-wider">Duração do Plano</label>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setMode(1)}
                  className={`py-3 rounded-xl text-sm font-medium transition-all border-2 ${mode === 1 ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-white' : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-purple-300'}`}
                >
                  1 Dia (Teste)
                </button>
                <button 
                  onClick={() => setMode(7)}
                  className={`py-3 rounded-xl text-sm font-medium transition-all border-2 ${mode === 7 ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-white' : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-purple-300'}`}
                >
                  7 Dias (Semanal)
                </button>
              </div>
            </div>

            {/* Opção 2: Quantidade de Refeições (IMPORTANTE!) */}
            <div>
              <label className="text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-3 block uppercase tracking-wider">Refeições por dia</label>
              <div className="grid grid-cols-4 gap-2">
                {[3, 4, 5, 6].map((count) => (
                  <button
                    key={count}
                    onClick={() => setMealsCount(count)}
                    className={`py-3 rounded-xl text-sm font-bold transition-all border-2 ${
                      mealsCount === count 
                        ? 'border-purple-500 bg-purple-600 text-white shadow-lg shadow-purple-500/30' 
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-purple-300'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-400 mt-2 h-4">
                {mealsCount === 3 && "Café, Almoço, Jantar"}
                {mealsCount === 4 && "Café, Almoço, Lanche, Jantar"}
                {mealsCount === 5 && "Café, Lanche, Almoço, Lanche, Jantar"}
                {mealsCount === 6 && "Café, Lanche, Almoço, Lanche, Jantar, Ceia"}
              </p>
            </div>

            {/* Opção 3: Variedade (Só aparece se for 7 dias) */}
            {mode === 7 && (
              <div className="animate-fadeIn">
                <label className="text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-3 block uppercase tracking-wider">Estilo de Rotina</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setVariety('varied')}
                    className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${variety === 'varied' ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10' : 'border-zinc-200 dark:border-zinc-800 hover:border-purple-300'}`}
                  >
                    <Shuffle className={`h-5 w-5 ${variety === 'varied' ? 'text-purple-600' : 'text-zinc-400'}`} />
                    <span className={`text-xs font-bold ${variety === 'varied' ? 'text-purple-700 dark:text-white' : 'text-zinc-500'}`}>Variedade Total</span>
                  </button>

                  <button 
                    onClick={() => setVariety('repetitive')}
                    className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${variety === 'repetitive' ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10' : 'border-zinc-200 dark:border-zinc-800 hover:border-purple-300'}`}
                  >
                    <Repeat className={`h-5 w-5 ${variety === 'repetitive' ? 'text-purple-600' : 'text-zinc-400'}`} />
                    <span className={`text-xs font-bold ${variety === 'repetitive' ? 'text-purple-700 dark:text-white' : 'text-zinc-500'}`}>Praticidade (Meal Prep)</span>
                  </button>
                </div>
              </div>
            )}

            <button 
              onClick={handleGenerate}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-bold text-lg shadow-xl shadow-purple-900/20 transition-all hover:scale-105 flex items-center justify-center gap-2 mt-6"
            >
              <Zap className="h-5 w-5 fill-current" />
              Gerar Estratégia
            </button>
          </div>
        </div>
      )}

      {/* --- LOADING --- */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <Loader2 className="h-12 w-12 text-purple-500 animate-spin" />
          <p className="text-zinc-500 dark:text-zinc-400 animate-pulse font-medium">
            {mode === 7 ? "A IA está planejando sua semana..." : "Calculando macros e porções..."}
          </p>
          <p className="text-xs text-zinc-400">Isso pode levar até 30 segundos.</p>
        </div>
      )}

      {/* --- RESULTADO DO PLANO --- */}
      {planData && currentDay && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Navegação de Dias (Se for semanal) */}
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
          
          {/* Cards de Macros */}
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

          {/* Lista de Refeições */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/30">
              <h3 className="font-semibold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
                <Utensils className="h-5 w-5 text-purple-500" /> Cardápio Sugerido
              </h3>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {currentDay.meals.map((meal, idx) => (
                <div key={idx} className="p-6 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors flex flex-col md:flex-row gap-4 justify-between items-start">
                  <div className="flex-1">
                    <h4 className="text-purple-600 dark:text-purple-400 font-bold mb-2 text-sm uppercase tracking-wide">
                      {meal.name}
                    </h4>
                    <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed text-sm">
                      {meal.suggestion}
                    </p>
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

          {/* Dica */}
          <div className="bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 p-6 rounded-xl flex gap-4 items-start">
            <Lightbulb className="h-6 w-6 text-purple-500 dark:text-purple-400 shrink-0 mt-1" />
            <div>
              <h4 className="font-bold text-purple-700 dark:text-purple-400 mb-1">Dica do NutriAgent</h4>
              <p className="text-purple-700/80 dark:text-purple-200/80 text-sm italic">"{currentDay.tip}"</p>
            </div>
          </div>

          {/* Ações Finais */}
          <div className="flex flex-col md:flex-row gap-4">
            <button 
              onClick={handleCreateShoppingList}
              className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-pink-900/20"
            >
              <ShoppingCart className="h-5 w-5" /> Gerar Lista de Compras
            </button>
            
            <button 
              onClick={() => setPlanData(null)} 
              className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 py-3 rounded-lg transition-colors font-medium"
            >
              Gerar Novo Plano
            </button>
          </div>

        </div>
      )}

    </div>
  );
}