import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import { Activity, Zap, Target, Trophy, Loader2, Sparkles } from "lucide-react";
import { StatCard } from "../components/admin/StatCard";
import { ChartCard } from "../components/admin/ChartCard";
import { EVENT_LABELS } from "../lib/adminLabels";

interface Usage {
  active_24h: number;
  active_7d: number;
  active_30d: number;
  activation_rate: number;
  onboarding_rate: number;
  avg_actions_per_active_user: number;
  feature_adoption: { feature: string; users: number; pct: number }[];
  usage_by_type_30d: { event_type: string; count: number }[];
  usage_over_time_30d: { date: string; count: number }[];
  recipes_by_source: { key: string; count: number }[];
  meal_plans_by_source: { key: string; count: number }[];
  top_users: { user_email: string; actions_count: number }[];
}

const SOURCE_COLORS: Record<string, string> = { IA: "#3b82f6", Manual: "#f97316", ai: "#3b82f6", manual: "#f97316" };
const SOURCE_LABELS: Record<string, string> = { ai: "IA", manual: "Manual", IA: "IA", Manual: "Manual" };

export function AdminUsage() {
  const { showAlert } = useAlert();
  const [data, setData] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/admin/usage")
      .then((res) => setData(res.data))
      .catch((e) => {
        showAlert("Erro ao carregar usabilidade.", "error");
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

  const adoptionData = data.feature_adoption.map((a) => ({ name: a.feature, pct: a.pct, users: a.users }));
  const usageByType = data.usage_by_type_30d.map((u) => ({ name: EVENT_LABELS[u.event_type] || u.event_type, count: u.count }));
  const overTime = data.usage_over_time_30d.map((u) => ({ date: format(parseISO(u.date), "dd/MM"), count: u.count }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Usabilidade</h1>
        <p className="text-sm text-zinc-500">
          Como a base usa o produto. "Ativos" = usuários cujo último login cai na janela (proxy de atividade).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Activity} label="Ativos (24h)" value={data.active_24h} sub={`${data.active_7d} em 7d · ${data.active_30d} em 30d`} color="text-teal-400" />
        <StatCard icon={Target} label="Taxa de ativação" value={`${data.activation_rate}%`} sub="usuários com perfil preenchido" color="text-green-400" />
        <StatCard icon={Sparkles} label="Onboarding" value={`${data.onboarding_rate}%`} sub="passaram pelo tour inicial" color="text-purple-400" />
        <StatCard icon={Zap} label="Ações / ativo" value={data.avg_actions_per_active_user} sub="média de ações de IA (30d)" color="text-amber-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Adoção de features (% da base)">
          <BarChart data={adoptionData} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
            <XAxis type="number" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} unit="%" />
            <YAxis type="category" dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} width={110} />
            <Tooltip
              contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }}
              formatter={(v: number, _n, p: any) => [`${v}% (${p.payload.users} usuários)`, "Adoção"]}
            />
            <Bar dataKey="pct" name="Adoção" fill="#a855f7" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Uso de IA por tipo (30 dias)">
          <BarChart data={usageByType}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="count" name="Usos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Atividade de IA ao longo do tempo (30 dias)" className="lg:col-span-2">
          <LineChart data={overTime}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis dataKey="date" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="count" name="Ações" stroke="#52cc02" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartCard>
      </div>

      {/* ORIGEM RECEITAS/PLANOS + TOP USERS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="grid grid-cols-2 gap-4">
          <SourceCard title="Receitas por origem" data={data.recipes_by_source} />
          <SourceCard title="Planos por origem" data={data.meal_plans_by_source} />
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-zinc-500" />
            <h2 className="font-semibold text-white">Usuários mais ativos</h2>
          </div>
          {data.top_users.length === 0 ? (
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
                {data.top_users.map((u, i) => (
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
    </div>
  );
}

function SourceCard({ title, data }: { title: string; data: { key: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const chart = data.map((d) => ({ name: SOURCE_LABELS[d.key] || d.key, count: d.count, key: d.key }));
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-zinc-300 mb-1">{title}</h3>
      <p className="text-xs text-zinc-500 mb-3">{total} no total</p>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart}>
            <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis hide allowDecimals={false} />
            <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="count" name="Qtd" radius={[4, 4, 0, 0]}>
              {chart.map((c) => (
                <Cell key={c.key} fill={SOURCE_COLORS[c.key] || "#71717a"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
