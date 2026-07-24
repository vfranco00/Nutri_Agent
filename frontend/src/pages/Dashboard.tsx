import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  User as UserIcon,
  ChefHat,
  Scale,
  ShoppingCart,
  Book,
  CheckCheck,
  Shield,
  CalendarRange,
  Flame,
  Trophy,
  BookOpen,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { api } from "../lib/api";
import { useSubscription } from "../lib/SubscriptionContext";
import type { User, Profile } from "../types";

interface WeightData {
  date: string;
  weight: number;
}

const QUICK_ACTIONS = [
  { name: "Meu Perfil", desc: "Metas e dados corporais", path: "/profile", icon: UserIcon, color: "green" },
  { name: "Minhas Receitas", desc: "Gerencie seus pratos", path: "/recipes", icon: Book, color: "orange" },
  { name: "Gerar Cardápio", desc: "Dieta personalizada com IA", path: "/ai-plan", icon: CheckCheck, color: "purple" },
  { name: "Chef IA", desc: "Receitas com o que você tem", path: "/ai-chef", icon: ChefHat, color: "blue" },
  { name: "Lista de Compras", desc: "Organize suas compras", path: "/shopping", icon: ShoppingCart, color: "pink" },
  { name: "Planos Alimentares", desc: "Monte e salve cardápios", path: "/meal-plans", icon: CalendarRange, color: "teal" },
] as const;

// Classes completas por cor (Tailwind precisa das strings inteiras no código).
const ACTION_COLORS: Record<string, { border: string; bg: string; icon: string }> = {
  green: { border: "hover:border-green-500", bg: "bg-green-100 dark:bg-green-500/10", icon: "text-green-600 dark:text-green-500" },
  orange: { border: "hover:border-orange-500", bg: "bg-orange-100 dark:bg-orange-500/10", icon: "text-orange-600 dark:text-orange-500" },
  purple: { border: "hover:border-purple-500", bg: "bg-purple-100 dark:bg-purple-500/10", icon: "text-purple-600 dark:text-purple-500" },
  blue: { border: "hover:border-blue-500", bg: "bg-blue-100 dark:bg-blue-500/10", icon: "text-blue-600 dark:text-blue-500" },
  pink: { border: "hover:border-pink-500", bg: "bg-pink-100 dark:bg-pink-500/10", icon: "text-pink-600 dark:text-pink-500" },
  teal: { border: "hover:border-teal-500", bg: "bg-teal-100 dark:bg-teal-500/10", icon: "text-teal-600 dark:text-teal-500" },
};

function getLevel(score = 0) {
  if (score < 50) return { title: "Iniciante", next: 50 };
  if (score < 200) return { title: "Cozinheiro", next: 200 };
  if (score < 500) return { title: "Chef", next: 500 };
  return { title: "MasterChef", next: 1000 };
}

export function Dashboard() {
  const navigate = useNavigate();
  const { subscription } = useSubscription();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [history, setHistory] = useState<WeightData[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const userRes = await api.get("/users/me");
        if (userRes?.data) setUser(userRes.data);
      } catch (e) {
        console.error("Erro ao buscar usuário:", e);
      }
      try {
        const profRes = await api.get("/profiles/me");
        if (profRes?.data) setProfile(profRes.data);
      } catch {
        // Perfil ainda não preenchido — segue sem meta calórica.
      }
      try {
        const historyRes = await api.get("/profiles/weight/history");
        setHistory(Array.isArray(historyRes?.data) ? historyRes.data : []);
      } catch (e) {
        setHistory([]);
        console.error("Erro ao buscar histórico de peso:", e);
      }
    }
    load();
  }, []);

  const level = getLevel(user?.score);
  const xpProgress = Math.min(100, Math.round(((user?.score || 0) / level.next) * 100));

  return (
    <div className="space-y-8">
      {/* SAUDAÇÃO */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-1 dark:text-white">
          Olá, {user?.full_name || "Visitante"}
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400">Bom te ver de volta. Aqui está o seu dia.</p>
      </div>

      {/* HERO STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Nível (anel de XP) */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="relative h-16 w-16 shrink-0">
            <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="3" className="stroke-zinc-200 dark:stroke-zinc-800" />
              <circle
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                strokeWidth="3"
                stroke="#52cc02"
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={`${xpProgress} 100`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-sm font-bold dark:text-white">
              {xpProgress}%
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-zinc-500 flex items-center gap-1">
              <Trophy className="h-3 w-3 text-amber-500" /> Nível
            </p>
            <p className="text-lg font-bold dark:text-white truncate">{level.title}</p>
            <p className="text-xs text-zinc-500">{user?.score || 0} XP</p>
          </div>
        </div>

        {/* Meta calórica */}
        <StatCard
          icon={Flame}
          iconColor="text-red-500"
          label="Meta diária"
          value={profile?.daily_calories ? `${Math.round(profile.daily_calories)}` : "—"}
          unit={profile?.daily_calories ? "kcal/dia" : undefined}
          hint={profile?.daily_calories ? undefined : "Preencha seu perfil"}
          onClick={() => navigate("/profile")}
        />

        {/* Receitas salvas */}
        <StatCard
          icon={BookOpen}
          iconColor="text-orange-500"
          label="Receitas salvas"
          value={subscription ? `${subscription.saved_recipes_used}` : "—"}
          unit={subscription?.max_saved_recipes != null ? `de ${subscription.max_saved_recipes}` : undefined}
          onClick={() => navigate("/recipes")}
        />

        {/* Planos alimentares */}
        <StatCard
          icon={CalendarRange}
          iconColor="text-teal-500"
          label="Planos salvos"
          value={subscription ? `${subscription.saved_meal_plans_used}` : "—"}
          unit={subscription?.max_saved_meal_plans != null ? `de ${subscription.max_saved_meal_plans}` : undefined}
          onClick={() => navigate("/meal-plans")}
        />
      </div>

      {/* AÇÕES RÁPIDAS */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wide">Ações rápidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {QUICK_ACTIONS.map((a) => {
            const c = ACTION_COLORS[a.color];
            return (
              <button
                key={a.path}
                onClick={() => navigate(a.path)}
                className={`text-left bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 ${c.border} transition-all cursor-pointer group hover:-translate-y-1 shadow-sm`}
              >
                <div className={`h-11 w-11 ${c.bg} rounded-lg flex items-center justify-center mb-3 transition-colors`}>
                  <a.icon className={`h-5 w-5 ${c.icon}`} />
                </div>
                <h3 className="font-semibold mb-1 dark:text-white">{a.name}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{a.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* GRÁFICO DE PESO */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold dark:text-white flex items-center gap-2">
            <Scale className="h-5 w-5 text-blue-600 dark:text-blue-500" /> Evolução de peso
          </h3>
          <button
            onClick={() => navigate("/profile")}
            className="text-sm text-blue-600 dark:text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 font-medium"
          >
            + Registrar peso
          </button>
        </div>

        <div className="h-64 w-full">
          {history.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} opacity={0.2} />
                <XAxis dataKey="date" stroke="#71717a" fontSize={12} tickFormatter={(str) => format(new Date(str), "dd/MM")} />
                <YAxis stroke="#71717a" fontSize={12} domain={["dataMin - 2", "dataMax + 2"]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "8px", color: "#fff" }}
                  labelFormatter={(label) => format(new Date(label), "dd/MM HH:mm")}
                />
                <Area type="monotone" dataKey="weight" stroke="#3b82f6" fillOpacity={1} fill="url(#colorWeight)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
              Nenhum dado registrado. Vá em Perfil para começar.
            </div>
          )}
        </div>
      </div>

      {/* ÁREA ADMIN (só superuser) */}
      {user?.is_superuser && (
        <button
          onClick={() => navigate("/admin")}
          className="w-full text-left bg-white dark:bg-zinc-900 p-6 rounded-xl border border-red-200 dark:border-red-900/50 hover:border-red-500 transition-all cursor-pointer group hover:-translate-y-1 shadow-sm flex items-center gap-4"
        >
          <div className="h-12 w-12 bg-red-100 dark:bg-red-500/10 rounded-lg flex items-center justify-center">
            <Shield className="h-6 w-6 text-red-600 dark:text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-1 text-red-600 dark:text-red-500">Painel Admin</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Usuários, finanças, usabilidade e chamados.</p>
          </div>
        </button>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  iconColor,
  label,
  value,
  unit,
  hint,
  onClick,
}: {
  icon: typeof Flame;
  iconColor: string;
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
    >
      <p className="text-xs text-zinc-500 flex items-center gap-1 mb-2">
        <Icon className={`h-3.5 w-3.5 ${iconColor}`} /> {label}
      </p>
      <p className="text-2xl font-bold dark:text-white">
        {value}
        {unit && <span className="text-sm font-normal text-zinc-500 ml-1">{unit}</span>}
      </p>
      {hint && <p className="text-xs text-zinc-500 mt-1">{hint}</p>}
    </button>
  );
}
