import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { AiPlan as AiPlanType } from '../types';
import { ArrowLeft, Sparkles, Loader2, Target, Zap, Utensils, Lightbulb } from 'lucide-react';

export function AiPlan() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<AiPlanType | null>(null);

  async function handleGenerate() {
    setLoading(true);
    try {
      // Chama a nossa rota do backend
      const response = await api.post('/ai/generate-plan');
      setPlan(response.data);
    } catch (error) {
      console.error(error);
      alert('Erro ao gerar plano. Verifique se você já preencheu seu Perfil!');
      navigate('/profile');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-4">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <ArrowLeft className="h-6 w-6 text-zinc-400" />
          </button>
          <h1 className="text-2xl font-bold text-purple-500 flex items-center gap-2">
            <Sparkles className="h-6 w-6" /> NutriAgent AI
          </h1>
        </div>

        {/* Estado Inicial (Sem plano) */}
        {!plan && !loading && (
          <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/50 rounded-xl border border-zinc-800 border-dashed text-center px-4">
            <div className="bg-purple-500/10 p-4 rounded-full mb-6">
              <Sparkles className="h-12 w-12 text-purple-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Gere seu Plano Personalizado</h2>
            <p className="text-zinc-400 max-w-md mb-8">
              Nossa IA vai analisar seu perfil (peso, altura, meta) e criar um cardápio exclusivo para o seu dia.
            </p>
            <button 
              onClick={handleGenerate}
              className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-purple-900/20 transition-all hover:scale-105 flex items-center gap-2"
            >
              <Zap className="h-5 w-5 fill-current" />
              Gerar Cardápio Mágico
            </button>
          </div>
        )}

        {/* Loading - IA Pensando */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <Loader2 className="h-12 w-12 text-purple-500 animate-spin" />
            <p className="text-zinc-400 animate-pulse">A IA está analisando seu perfil e montando a dieta...</p>
          </div>
        )}

        {/* Resultado - O Plano */}
        {plan && !loading && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Metas e Macros */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex flex-col items-center justify-center text-center">
                <Target className="h-6 w-6 text-red-500 mb-2" />
                <span className="text-2xl font-bold text-white">{plan.calories_target}</span>
                <span className="text-xs text-zinc-500 uppercase tracking-wider">Calorias/Dia</span>
              </div>
              <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-bold text-blue-400">{plan.macros.protein}</span>
                <span className="text-xs text-zinc-500 uppercase">Proteína</span>
              </div>
              <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-bold text-yellow-400">{plan.macros.carbs}</span>
                <span className="text-xs text-zinc-500 uppercase">Carbo</span>
              </div>
              <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-bold text-orange-400">{plan.macros.fats}</span>
                <span className="text-xs text-zinc-500 uppercase">Gordura</span>
              </div>
            </div>

            {/* Refeições */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="p-4 border-b border-zinc-800 bg-zinc-950/50">
                <h3 className="font-semibold text-zinc-200 flex items-center gap-2">
                  <Utensils className="h-5 w-5 text-purple-500" /> Sugestão de Cardápio
                </h3>
              </div>
              <div className="divide-y divide-zinc-800">
                {plan.meals.map((meal, idx) => (
                  <div key={idx} className="p-6 hover:bg-zinc-800/50 transition-colors">
                    <h4 className="text-purple-400 font-bold mb-2 text-sm uppercase tracking-wide">{meal.name}</h4>
                    <p className="text-zinc-300 leading-relaxed">{meal.suggestion}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Dica da IA */}
            <div className="bg-purple-500/10 border border-purple-500/20 p-6 rounded-xl flex gap-4 items-start">
              <Lightbulb className="h-6 w-6 text-purple-400 shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-purple-400 mb-1">Dica do NutriAgent</h4>
                <p className="text-purple-200/80 text-sm italic">"{plan.tip}"</p>
              </div>
            </div>

            <button 
              onClick={handleGenerate}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-3 rounded-lg transition-colors border border-zinc-700"
            >
              Gerar Novamente
            </button>

          </div>
        )}

      </div>
    </div>
  );
}