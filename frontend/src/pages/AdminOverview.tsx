import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import {
  Users,
  UserCheck,
  Receipt,
  DollarSign,
  TrendingUp,
  Activity,
  MessageCircleQuestion,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { StatCard } from "../components/admin/StatCard";

interface Overview {
  users_total: number;
  users_active: number;
  new_users_7d: number;
  new_users_30d: number;
  revenue_confirmed_brl: number;
  mrr_estimate_brl: number;
  paying_users: number;
  conversion_rate: number;
  active_24h: number;
  active_7d: number;
  active_30d: number;
  usage_30d_total: number;
  open_tickets: number;
  tickets_7d: number;
  signups_last_14d: { date: string; count: number }[];
}

export function AdminOverview() {
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/admin/overview")
      .then((res) => setData(res.data))
      .catch((e) => {
        showAlert("Erro ao carregar a visão geral.", "error");
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

  const signups = data.signups_last_14d.map((s) => ({
    date: format(parseISO(s.date), "dd/MM"),
    count: s.count,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Visão Geral</h1>
        <p className="text-sm text-zinc-500">O pulso do NutriAgent num lugar só — números reais do sistema.</p>
      </div>

      {/* USUÁRIOS */}
      <Section title="Usuários" onClick={() => navigate("/admin/users")}>
        <StatCard icon={Users} label="Usuários totais" value={data.users_total} sub={`${data.users_active} ativos`} color="text-blue-400" />
        <StatCard icon={UserCheck} label="Novos (7 dias)" value={data.new_users_7d} sub={`${data.new_users_30d} nos últimos 30 dias`} color="text-blue-400" />
        <StatCard icon={Activity} label="Ativos (24h)" value={data.active_24h} sub={`${data.active_7d} em 7d · ${data.active_30d} em 30d`} color="text-teal-400" />
      </Section>

      {/* FINANÇAS */}
      <Section title="Finanças" onClick={() => navigate("/admin/finance")}>
        <StatCard icon={Receipt} label="Receita confirmada" value={`R$ ${data.revenue_confirmed_brl.toFixed(2)}`} sub="Mercado Pago (dado real)" color="text-green-400" />
        <StatCard icon={DollarSign} label="MRR estimado" value={`R$ ${data.mrr_estimate_brl.toFixed(2)}`} sub={`${data.paying_users} pagante(s)`} color="text-zinc-400" />
        <StatCard icon={TrendingUp} label="Conversão" value={`${data.conversion_rate}%`} sub="pagantes / base total" color="text-green-400" />
      </Section>

      {/* USABILIDADE + CHAMADOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Usabilidade" onClick={() => navigate("/admin/usage")} compact>
          <StatCard icon={Activity} label="Ações de IA (30d)" value={data.usage_30d_total} color="text-purple-400" />
        </Section>
        <Section title="Chamados" onClick={() => navigate("/admin/tickets")} compact>
          <StatCard icon={MessageCircleQuestion} label="Abertos" value={data.open_tickets} sub={`${data.tickets_7d} novos em 7 dias`} color="text-amber-400" />
        </Section>
      </div>

      {/* SPARKLINE DE CADASTROS */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Novos cadastros (últimos 14 dias)</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={signups}>
              <XAxis dataKey="date" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="count" name="Cadastros" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  onClick,
  children,
  compact,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div>
      <button
        onClick={onClick}
        className="group flex items-center gap-2 mb-3 text-sm font-semibold text-zinc-300 hover:text-white transition-colors"
      >
        {title}
        <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all" />
      </button>
      <div className={`grid gap-4 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
        {children}
      </div>
    </div>
  );
}
