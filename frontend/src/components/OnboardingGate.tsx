import { type ReactNode, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  Book,
  CheckCheck,
  ChefHat,
  ShoppingCart,
  CalendarRange,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { api } from "../lib/api";

const TOUR_STEPS = [
  {
    icon: Book,
    title: "Minhas Receitas",
    color: "text-orange-500",
    bg: "bg-orange-100 dark:bg-orange-500/10",
    description: "Guarde suas receitas favoritas e descubra receitas da comunidade.",
  },
  {
    icon: CheckCheck,
    title: "Gerar Cardápio",
    color: "text-purple-500",
    bg: "bg-purple-100 dark:bg-purple-500/10",
    description: "A IA monta um cardápio de 1 ou 7 dias com base no seu perfil.",
  },
  {
    icon: ChefHat,
    title: "Chef IA",
    color: "text-blue-500",
    bg: "bg-blue-100 dark:bg-blue-500/10",
    description: "Diga o que você tem na geladeira e a IA cria uma receita na hora.",
  },
  {
    icon: ShoppingCart,
    title: "Lista de Compras",
    color: "text-pink-500",
    bg: "bg-pink-100 dark:bg-pink-500/10",
    description: "Organize o que precisa comprar, direto a partir do seu cardápio.",
  },
  {
    icon: CalendarRange,
    title: "Planos Alimentares",
    color: "text-teal-500",
    bg: "bg-teal-100 dark:bg-teal-500/10",
    description: "Salve os cardápios gerados pela IA ou monte o seu com suas receitas.",
  },
];

function TourModal({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0);
  const isLast = step === TOUR_STEPS.length - 1;
  const current = TOUR_STEPS[step];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-8 text-center">
          <div className={`mx-auto mb-5 w-16 h-16 rounded-2xl flex items-center justify-center ${current.bg}`}>
            <Icon className={`h-8 w-8 ${current.color}`} />
          </div>
          <h2 className="text-xl font-bold dark:text-white mb-2">{current.title}</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
            {current.description}
          </p>
        </div>

        <div className="flex items-center justify-center gap-1.5 pb-4">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-green-500" : "w-1.5 bg-zinc-200 dark:bg-zinc-700"}`}
            />
          ))}
        </div>

        <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/40">
          <button
            onClick={onFinish}
            className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium"
          >
            Pular
          </button>
          <button
            onClick={() => (isLast ? onFinish() : setStep((s) => s + 1))}
            className="bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2.5 rounded-lg flex items-center gap-2 transition-colors"
          >
            {isLast ? "Começar a usar" : "Próximo"}
            {!isLast && <ArrowRight className="h-4 w-4" />}
            {isLast && <Sparkles className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export function OnboardingGate({ children }: { children: ReactNode }) {
  const { user, refreshUser } = useAuth();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);

  if (!user) return <>{children}</>;

  // Primeira vez: sem perfil ainda. Manda pra tela de perfil (a "anamnese").
  if (!user.has_profile && location.pathname !== "/profile") {
    return <Navigate to="/profile?onboarding=1" replace />;
  }

  const showTour = user.has_profile && !user.has_seen_onboarding && !dismissed;

  async function handleFinishTour() {
    setDismissed(true);
    try {
      await api.put("/users/me/onboarding-complete");
      await refreshUser();
    } catch (error) {
      console.error("Erro ao concluir onboarding:", error);
    }
  }

  return (
    <>
      {children}
      {showTour && <TourModal onFinish={handleFinishTour} />}
    </>
  );
}
