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
import { ROUTES } from "../routes";
import { Button } from "./ui/Button";

const TOUR_STEPS = [
  {
    icon: Book,
    title: "Minhas Receitas",
    description: "Guarde suas receitas favoritas e descubra receitas da comunidade.",
  },
  {
    icon: CheckCheck,
    title: "Gerar Cardápio",
    description: "A IA monta um cardápio de 1 ou 7 dias com base no seu perfil.",
  },
  {
    icon: ChefHat,
    title: "Chef IA",
    description: "Diga o que você tem na geladeira e a IA cria uma receita na hora.",
  },
  {
    icon: ShoppingCart,
    title: "Lista de Compras",
    description: "Organize o que precisa comprar, direto a partir do seu cardápio.",
  },
  {
    icon: CalendarRange,
    title: "Planos Alimentares",
    description: "Salve os cardápios gerados pela IA ou monte o seu com suas receitas.",
  },
];

export function TourModal({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0);
  const isLast = step === TOUR_STEPS.length - 1;
  const current = TOUR_STEPS[step];
  const Icon = current.icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Conheça o Nuvi"
      className="fixed inset-0 z-150 flex items-center justify-center bg-black/70 p-4 animate-fadeIn"
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-line bg-card shadow-2xl">
        <div className="p-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-act-soft">
            <Icon className="h-8 w-8 text-act-text" aria-hidden />
          </div>
          <h2 className="mb-2 text-xl font-extrabold text-ink">{current.title}</h2>
          <p className="text-sm leading-relaxed text-mut">{current.description}</p>
        </div>

        <div className="flex items-center justify-center gap-1.5 pb-4">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-act" : "w-1.5 bg-line"}`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-line bg-soft p-6">
          <button onClick={onFinish} className="text-sm font-bold text-mut hover:text-ink">
            Pular
          </button>
          <Button onClick={() => (isLast ? onFinish() : setStep((s) => s + 1))}>
            {isLast ? "Começar a usar" : "Próximo"}
            {!isLast && <ArrowRight className="h-4 w-4" aria-hidden />}
            {isLast && <Sparkles className="h-4 w-4" aria-hidden />}
          </Button>
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
  if (!user.has_profile && location.pathname !== ROUTES.perfil) {
    return <Navigate to={`${ROUTES.perfil}?onboarding=1`} replace />;
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
