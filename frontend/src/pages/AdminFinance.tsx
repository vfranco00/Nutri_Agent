import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import { Receipt, DollarSign, TrendingUp, Users, Coins, CreditCard, Loader2, RefreshCw, XCircle, Clock } from "lucide-react";
import { StatCard } from "../components/admin/StatCard";
import { ChartCard } from "../components/admin/ChartCard";
import { PLAN_COLORS, PAYMENT_STATUS_LABELS } from "../lib/adminLabels";

interface Finance {
  revenue_confirmed_brl: number;
  mrr_estimate_brl: number;
  paying_users: number;
  conversion_rate: number;
  arpu_brl: number;
  avg_ticket_brl: number;
  revenue_by_month: { month: string; total: number }[];
  plan_distribution: { starter: number; plus: number; pro: number };
  subscriptions: { active: number; canceled: number; expiring_7d: number };
  payments_by_status: { key: string; count: number }[];
}

interface PaymentEntry {
  user_email: string;
  plan: string;
  amount_brl: number;
  status: string;
  created_at: string;
}

export function AdminFinance() {
  const { showAlert } = useAlert();
  const [data, setData] = useState<Finance | null>(null);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get("/admin/finance"), api.get("/admin/payments", { params: { limit: 15 } })])
      .then(([fin, pay]) => {
        setData(fin.data);
        setPayments(pay.data.entries);
      })
      .catch((e) => {
        showAlert("Erro ao carregar finanças.", "error");
        console.error(e);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !data) {
    return (
      <div className="flex justify-center mt-20">
        <Loader2 className="animate-spin h-8 w-8 text-red-500" />
      </div>
    );
  }

  const planData = [
    { name: "Starter", value: data.plan_distribution.starter, color: PLAN_COLORS.starter },
    { name: "Plus", value: data.plan_distribution.plus, color: PLAN_COLORS.plus },
    { name: "Pro", value: data.plan_distribution.pro, color: PLAN_COLORS.pro },
  ];

  const revenueData = data.revenue_by_month.map((m) => ({
    month: m.month.slice(5) + "/" + m.month.slice(2, 4), // "MM/YY"
    total: m.total,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Finanças</h1>
        <p className="text-sm text-zinc-500">
          Receita real (cobranças confirmadas pelo Mercado Pago) ao lado da projeção de MRR pelos planos ativos.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={Receipt} label="Receita confirmada" value={`R$ ${data.revenue_confirmed_brl.toFixed(2)}`} sub="Soma de cobranças aprovadas" color="text-green-400" />
        <StatCard icon={DollarSign} label="MRR estimado" value={`R$ ${data.mrr_estimate_brl.toFixed(2)}`} sub="Projeção pelos planos ativos" color="text-zinc-400" />
        <StatCard icon={TrendingUp} label="Conversão" value={`${data.conversion_rate}%`} sub={`${data.paying_users} pagante(s) na base`} color="text-green-400" />
        <StatCard icon={Users} label="ARPU" value={`R$ ${data.arpu_brl.toFixed(2)}`} sub="Receita média por pagante (MRR)" color="text-blue-400" />
        <StatCard icon={Coins} label="Ticket médio" value={`R$ ${data.avg_ticket_brl.toFixed(2)}`} sub="Média das cobranças aprovadas" color="text-amber-400" />
        <StatCard icon={CreditCard} label="Assinaturas ativas" value={data.subscriptions.active} sub={`${data.subscriptions.expiring_7d} vencendo em 7 dias`} color="text-teal-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Receita confirmada por mês (12 meses)" className="lg:col-span-2">
          <BarChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis dataKey="month" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Receita"]}
            />
            <Bar dataKey="total" name="Receita" fill="#52cc02" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Distribuição de planos">
          <PieChart>
            <Pie data={planData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
              {planData.map((e) => (
                <Cell key={e.name} fill={e.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ChartCard>

        {/* ASSINATURAS + PAGAMENTOS POR STATUS */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-300">Assinaturas & cobranças</h3>
          <div className="grid grid-cols-3 gap-3">
            <MiniStat icon={CreditCard} label="Ativas" value={data.subscriptions.active} color="text-teal-400" />
            <MiniStat icon={XCircle} label="Canceladas" value={data.subscriptions.canceled} color="text-red-400" />
            <MiniStat icon={Clock} label="Vencendo 7d" value={data.subscriptions.expiring_7d} color="text-amber-400" />
          </div>
          <div className="pt-2 border-t border-zinc-800">
            <p className="text-xs text-zinc-500 mb-2 flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Cobranças por status
            </p>
            <div className="flex flex-wrap gap-2">
              {data.payments_by_status.length === 0 ? (
                <span className="text-xs text-zinc-500">Nenhuma cobrança registrada ainda.</span>
              ) : (
                data.payments_by_status.map((s) => {
                  const info = PAYMENT_STATUS_LABELS[s.key] || {
                    label: s.key,
                    className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
                  };
                  return (
                    <span key={s.key} className={`text-xs px-2.5 py-1 rounded-full border ${info.className}`}>
                      {info.label}: {s.count}
                    </span>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* VENDAS RECENTES */}
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
                const info = PAYMENT_STATUS_LABELS[p.status] || {
                  label: p.status,
                  className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
                };
                return (
                  <tr key={i} className="border-b border-zinc-800 last:border-0">
                    <td className="px-6 py-3 text-zinc-300">{p.user_email}</td>
                    <td className="px-6 py-3 text-zinc-400 capitalize">{p.plan}</td>
                    <td className="px-6 py-3 text-zinc-300">R$ {p.amount_brl.toFixed(2)}</td>
                    <td className="px-6 py-3 text-right">
                      <span className={`text-xs px-2 py-1 rounded-full border ${info.className}`}>{info.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, color }: { icon: typeof Users; label: string; value: number; color: string }) {
  return (
    <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-3 text-center">
      <Icon className={`h-4 w-4 mx-auto mb-1 ${color}`} />
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
    </div>
  );
}
