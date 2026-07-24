import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import {
  MessageCircleQuestion,
  CheckCircle2,
  Circle,
  Loader2,
  Search,
  RotateCcw,
  Check,
  Mail,
  Clock,
} from "lucide-react";
import { StatCard } from "../components/admin/StatCard";
import { FEEDBACK_CATEGORY_LABELS } from "../lib/adminLabels";

interface Ticket {
  id: number;
  user_id: number | null;
  name: string | null;
  email: string;
  category: string;
  message: string;
  status: string;
  resolved_at: string | null;
  created_at: string;
}

interface Summary {
  open_total: number;
  resolved_total: number;
  tickets_last_30d: number;
  status_breakdown: { key: string; count: number }[];
  category_breakdown: { key: string; count: number }[];
  tickets_over_time_30d: { date: string; count: number }[];
}

const CATEGORY_COLORS: Record<string, string> = {
  duvida: "#3b82f6",
  bug: "#ef4444",
  sugestao: "#a855f7",
  outro: "#71717a",
};

type StatusFilter = "todos" | "aberto" | "resolvido";

export function AdminTickets() {
  const { showAlert, confirmDialog } = useAlert();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [categoryFilter, setCategoryFilter] = useState<string>("todas");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "todos") params.status = statusFilter;
      if (categoryFilter !== "todas") params.category = categoryFilter;
      const [ticketsRes, summaryRes] = await Promise.all([
        api.get("/admin/feedback", { params: { ...params, limit: 100 } }),
        api.get("/admin/feedback/summary"),
      ]);
      setTickets(ticketsRes.data.entries);
      setSummary(summaryRes.data);
    } catch (e) {
      showAlert("Erro ao carregar chamados.", "error");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, categoryFilter]);

  const filteredTickets = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return tickets;
    return tickets.filter((t) => t.email.toLowerCase().includes(term) || (t.name || "").toLowerCase().includes(term));
  }, [tickets, search]);

  async function handleToggleStatus(ticket: Ticket) {
    const resolving = ticket.status !== "resolvido";
    const ok = await confirmDialog(
      resolving
        ? `Marcar o chamado de ${ticket.email} como resolvido?`
        : `Reabrir o chamado de ${ticket.email}?`,
      { confirmLabel: resolving ? "Resolver" : "Reabrir" },
    );
    if (!ok) return;

    setUpdatingId(ticket.id);
    try {
      const res = await api.put(`/admin/feedback/${ticket.id}/status`, {
        status: resolving ? "resolvido" : "aberto",
      });
      setTickets((prev) => prev.map((t) => (t.id === ticket.id ? res.data : t)));
      // Recarrega o resumo pra os contadores baterem; se o filtro esconde o novo status, some da lista.
      const summaryRes = await api.get("/admin/feedback/summary");
      setSummary(summaryRes.data);
      if (statusFilter !== "todos" && statusFilter !== res.data.status) {
        setTickets((prev) => prev.filter((t) => t.id !== ticket.id));
      }
      showAlert(resolving ? "Chamado resolvido." : "Chamado reaberto.", "success");
    } catch (e) {
      showAlert("Erro ao atualizar o chamado.", "error");
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading && !summary) {
    return (
      <div className="flex justify-center mt-20">
        <Loader2 className="animate-spin h-8 w-8 text-red-500" />
      </div>
    );
  }

  const categoryData = (summary?.category_breakdown || []).map((c) => ({
    name: FEEDBACK_CATEGORY_LABELS[c.key] || c.key,
    count: c.count,
    key: c.key,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Chamados</h1>
        <p className="text-sm text-zinc-500">Gestão dos chamados de ajuda e feedback abertos pelos usuários.</p>
      </div>

      {summary && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={Circle} label="Abertos" value={summary.open_total} color="text-amber-400" />
            <StatCard icon={CheckCircle2} label="Resolvidos" value={summary.resolved_total} color="text-green-400" />
            <StatCard icon={Clock} label="Novos (30 dias)" value={summary.tickets_last_30d} color="text-blue-400" />
          </div>

          {categoryData.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-zinc-300 mb-4">Chamados por categoria</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" name="Chamados" radius={[4, 4, 0, 0]}>
                      {categoryData.map((c) => (
                        <Cell key={c.key} fill={CATEGORY_COLORS[c.key] || "#71717a"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

      {/* FILTROS */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          {(["todos", "aberto", "resolvido"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                statusFilter === s ? "bg-red-500/10 text-red-400" : "text-zinc-400 hover:text-white"
              }`}
            >
              {s === "todos" ? "Todos" : s === "aberto" ? "Abertos" : "Resolvidos"}
            </button>
          ))}
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="todas">Todas as categorias</option>
          {Object.entries(FEEDBACK_CATEGORY_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>

        <div className="relative flex-1 lg:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por email ou nome..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 pl-9 pr-3 text-sm text-white outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      </div>

      {/* LISTA */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-zinc-800 flex items-center gap-2">
          <MessageCircleQuestion className="h-5 w-5 text-zinc-500" />
          <h2 className="font-semibold text-white">{filteredTickets.length} chamado(s)</h2>
        </div>

        {filteredTickets.length === 0 ? (
          <p className="p-6 text-sm text-zinc-500">Nenhum chamado encontrado com esses filtros.</p>
        ) : (
          <div className="divide-y divide-zinc-800">
            {filteredTickets.map((t) => {
              const isResolved = t.status === "resolvido";
              const isOpen = expanded === t.id;
              return (
                <div key={t.id} className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <button onClick={() => setExpanded(isOpen ? null : t.id)} className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-medium text-red-400">
                          {FEEDBACK_CATEGORY_LABELS[t.category] || t.category}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border ${
                            isResolved
                              ? "bg-green-500/10 text-green-400 border-green-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}
                        >
                          {isResolved ? "Resolvido" : "Aberto"}
                        </span>
                        <span className="text-xs text-zinc-500 flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {t.email}
                        </span>
                      </div>
                      <p className={`text-sm text-zinc-300 ${isOpen ? "" : "line-clamp-1"}`}>{t.message}</p>
                      <p className="text-[11px] text-zinc-600 mt-1">
                        {format(parseISO(t.created_at), "dd/MM/yyyy HH:mm")}
                        {t.resolved_at && ` · resolvido em ${format(parseISO(t.resolved_at), "dd/MM/yyyy HH:mm")}`}
                      </p>
                    </button>

                    <button
                      onClick={() => handleToggleStatus(t)}
                      disabled={updatingId === t.id}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                        isResolved
                          ? "text-zinc-400 hover:bg-zinc-800"
                          : "bg-green-600 hover:bg-green-700 text-white"
                      }`}
                      title={isResolved ? "Reabrir chamado" : "Marcar como resolvido"}
                    >
                      {updatingId === t.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isResolved ? (
                        <>
                          <RotateCcw className="h-3.5 w-3.5" /> Reabrir
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" /> Resolver
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
