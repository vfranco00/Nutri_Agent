import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import { Users, DollarSign, BookOpen, CalendarRange, Loader2, Activity, TrendingUp, Trophy, Receipt } from "lucide-react";

interface AdminMetrics {
  users_total: number;
  users_active: number;
  users_verified: number;
  users_by_plan: { starter: number; plus: number; pro: number };
  mrr_estimate_brl: number;
  is_estimate: boolean;
  revenue_confirmed_brl: number;
  payments_last_30_days: number;
  saved_recipes_total: number;
  saved_meal_plans_total: number;
  usage_last_30_days: { event_type: string; count: number }[];
  signups_last_30_days: { date: string; count: number }[];
}

interface ActivityEntry {
  user_email: string;
  event_type: string;
  created_at: string;
}

interface PaymentEntry {
  user_email: string;
  plan: string;
  amount_brl: number;
  status: string;
  created_at: string;
}

interface TopUserEntry {
  user_email: string;
  actions_count: number;
}

const PAYMENT_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  approved: { label: "Aprovado", className: "bg-green-500/10 text-green-400 border-green-500/20" },
  rejected: { label: "Rejeitado", className: "bg-red-500/10 text-red-400 border-red-500/20" },
  pending: { label: "Pendente", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
};

const PLAN_COLORS = { starter: "#71717a", plus: "#22c55e", pro: "#a855f7" };
const EVENT_LABELS: Record<string, string> = {
  chef_ai: "Chef IA",
  generate_plan_daily: "Cardápio diário",
  generate_plan_weekly: "Cardápio semanal",
  generate_plan_starter: "Cardápio (Starter)",
  meal_swap: "Troca de refeição",
};

export function AdminDashboard() {
  const { showAlert } = useAlert();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [topUsers, setTopUsers] = useState<TopUserEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [metricsRes, activityRes, paymentsRes, topUsersRes] = await Promise.all([
          api.get("/admin/metrics"),
          api.get("/admin/activity", { params: { limit: 15 } }),
          api.get("/admin/payments", { params: { limit: 10 } }),
          api.get("/admin/top-users"),
        ]);
        setMetrics(metricsRes.data);
        setActivity(activityRes.data.entries);
        setPayments(paymentsRes.data.entries);
        setTopUsers(topUsersRes.data.entries);
      } catch (error) {
        showAlert("Erro ao carregar métricas.", "error");
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !metrics) {
    return (
      <div className="flex justify-center mt-20">
        <Loader2 className="animate-spin h-8 w-8 text-red-500" />
      </div>
    );
  }

  const planData = [
    { name: "Starter", value: metrics.users_by_plan.starter, color: PLAN_COLORS.starter },
    { name: "Plus", value: metrics.users_by_plan.plus, color: PLAN_COLORS.plus },
    { name: "Pro", value: metrics.users_by_plan.pro, color: PLAN_COLORS.pro },
  ];

  const usageData = metrics.usage_last_30_days.map((u) => ({
    name: EVENT_LABELS[u.event_type] || u.event_type,
    count: u.count,
  }));

  const signupsData = metrics.signups_last_30_days.map((s) => ({
    date: format(parseISO(s.date), "dd/MM"),
    count: s.count,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Métricas</h1>
        <p className="text-sm text-zinc-500">
          Baseado em dados reais do sistema e nas cobranças confirmadas pelo Mercado Pago — sem tracking de requests HTTP.
        </p>
      </div>

      {/* CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Usuários totais" value={metrics.users_total} sub={`${metrics.users_active} ativos · ${metrics.users_verified} verificados`} color="text-blue-400" />
        <StatCard
          icon={Receipt}
          label="Receita confirmada"
          value={`R$ ${metrics.revenue_confirmed_brl.toFixed(2)}`}
          sub={`${metrics.payments_last_30_days} cobrança(s) nos últimos 30 dias — dado real, Mercado Pago`}
          color="text-green-400"
        />
        <StatCard
          icon={DollarSign}
          label="MRR estimado"
          value={`R$ ${metrics.mrr_estimate_brl.toFixed(2)}`}
          sub="Projeção pelos planos atribuídos — não é receita confirmada"
          color="text-zinc-400"
        />
        <StatCard icon={BookOpen} label="Receitas salvas" value={metrics.saved_recipes_total} color="text-orange-400" />
        <StatCard icon={CalendarRange} label="Planos alimentares salvos" value={metrics.saved_meal_plans_total} color="text-teal-400" />
      </div>

      {/* GRÁFICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Novos usuários (últimos 30 dias)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={signupsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="date" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="count" name="Novos usuários" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Distribuição de planos</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={planData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {planData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Uso de IA por tipo (últimos 30 dias)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" name="Usos" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* VENDAS + USUÁRIOS MAIS ATIVOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-zinc-500" />
            <h2 className="font-semibold text-white">Vendas recentes</h2>
          </div>
          {payments.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500">
              Nenhuma cobrança confirmada ainda. Assim que o Mercado Pago mandar o webhook de uma cobrança, ela aparece aqui.
            </p>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-zinc-500 uppercase bg-zinc-950/50 border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-3">Usuário</th>
                  <th className="px-6 py-3">Plano</th>
                  <th className="px-6 py-3">Valor</th>
                  <th className="px-6 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => {
                  const statusInfo = PAYMENT_STATUS_LABELS[p.status] || {
                    label: p.status,
                    className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
                  };
                  return (
                    <tr key={i} className="border-b border-zinc-800 last:border-0">
                      <td className="px-6 py-3 text-zinc-300">{p.user_email}</td>
                      <td className="px-6 py-3 text-zinc-400 capitalize">{p.plan}</td>
                      <td className="px-6 py-3 text-zinc-300">R$ {p.amount_brl.toFixed(2)}</td>
                      <td className="px-6 py-3 text-right">
                        <span className={`text-xs px-2 py-1 rounded-full border ${statusInfo.className}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-zinc-500" />
            <h2 className="font-semibold text-white">Usuários mais ativos</h2>
          </div>
          {topUsers.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500">Nenhuma atividade registrada ainda.</p>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-zinc-500 uppercase bg-zinc-950/50 border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-3">#</th>
                  <th className="px-6 py-3">Usuário</th>
                  <th className="px-6 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {topUsers.map((u, i) => (
                  <tr key={i} className="border-b border-zinc-800 last:border-0">
                    <td className="px-6 py-3 text-zinc-500">{i + 1}</td>
                    <td className="px-6 py-3 text-zinc-300">{u.user_email}</td>
                    <td className="px-6 py-3 text-right text-zinc-300 font-semibold">{u.actions_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ATIVIDADE RECENTE */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-zinc-800 flex items-center gap-2">
          <Activity className="h-5 w-5 text-zinc-500" />
          <h2 className="font-semibold text-white">Atividade recente</h2>
        </div>
        {activity.length === 0 ? (
          <p className="p-6 text-sm text-zinc-500">Nenhuma atividade registrada ainda.</p>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-500 uppercase bg-zinc-950/50 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-3">Usuário</th>
                <th className="px-6 py-3">Ação</th>
                <th className="px-6 py-3 text-right">Quando</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((entry, i) => (
                <tr key={i} className="border-b border-zinc-800 last:border-0">
                  <td className="px-6 py-3 text-zinc-300">{entry.user_email}</td>
                  <td className="px-6 py-3 text-zinc-400">{EVENT_LABELS[entry.event_type] || entry.event_type}</td>
                  <td className="px-6 py-3 text-right text-zinc-500 text-xs">
                    {format(parseISO(entry.created_at), "dd/MM/yyyy HH:mm")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className={`flex items-center gap-2 mb-2 ${color}`}>
        <Icon className="h-5 w-5" />
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
}
