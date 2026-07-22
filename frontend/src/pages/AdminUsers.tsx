import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAlert } from '../lib/AlertContext';
import type { User } from '../types';
import {
  Users,
  Mail,
  CheckCircle2,
  XCircle,
  Trash2,
  Info,
  X,
  Loader2,
  Search,
  ShieldCheck,
  ShieldOff,
  Clock,
  Activity,
  LifeBuoy,
} from 'lucide-react';

interface ActivityEntry {
  user_email: string;
  event_type: string;
  created_at: string;
}

interface FeedbackEntry {
  id: number;
  category: string;
  message: string;
  created_at: string;
}

const EVENT_LABELS: Record<string, string> = {
  chef_ai: "Chef IA",
  generate_plan_daily: "Cardápio diário",
  generate_plan_weekly: "Cardápio semanal",
  generate_plan_starter: "Cardápio (Starter)",
  meal_swap: "Troca de refeição",
};

const FEEDBACK_CATEGORY_LABELS: Record<string, string> = {
  duvida: "Dúvida",
  bug: "Bug",
  sugestao: "Sugestão",
  outro: "Outro",
};

function formatDateTime(value?: string | null) {
  if (!value) return "Nunca";
  return new Date(value).toLocaleString('pt-BR');
}

export function AdminUsers() {
  const { showAlert, confirmDialog } = useAlert();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [detailUser, setDetailUser] = useState<User | null>(null);
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  const [feedbackEntries, setFeedbackEntries] = useState<FeedbackEntry[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (u) => (u.full_name || "").toLowerCase().includes(term) || u.email.toLowerCase().includes(term),
    );
  }, [users, search]);

  async function loadUsers() {
    try {
      const res = await api.get('/users/');
      setUsers(res.data);
    } catch (error) {
      showAlert('Erro ao carregar usuários.', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!(await confirmDialog("Tem certeza que deseja BANIR este usuário? Essa ação deleta tudo dele.", { danger: true, confirmLabel: 'Banir' }))) return;
    try {
      await api.delete(`/users/${id}`);
      setUsers(users.filter(u => u.id !== id));
    } catch (e) { showAlert("Erro ao deletar.", 'error'); console.error(e); }
  }

  async function handleToggleStatus(user: User) {
    try {
      await api.put(`/users/${user.id}/toggle-status`);
      setUsers(users.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u));
    } catch (e) { showAlert("Erro ao alterar status.", 'error'); console.error(e); }
  }

  async function handleToggleAdmin(user: User) {
    const willPromote = !user.is_superuser;
    const confirmed = await confirmDialog(
      willPromote
        ? `Promover ${user.full_name || user.email} a admin? Essa pessoa vai ter acesso total ao painel.`
        : `Remover o privilégio de admin de ${user.full_name || user.email}?`,
      { danger: !willPromote, confirmLabel: willPromote ? "Promover" : "Remover" },
    );
    if (!confirmed) return;

    try {
      const res = await api.put(`/users/${user.id}/toggle-admin`);
      setUsers(users.map(u => u.id === user.id ? { ...u, is_superuser: res.data.is_superuser } : u));
      showAlert(
        res.data.is_superuser ? "Usuário promovido a admin." : "Privilégio de admin removido.",
        "success",
      );
    } catch (e: any) {
      showAlert(e.response?.data?.detail || "Erro ao alterar privilégio de admin.", 'error');
      console.error(e);
    }
  }

  async function handleChangePlan(user: User, plan: string) {
    try {
      await api.put(`/users/${user.id}/subscription`, { plan });
      setUsers(users.map(u => u.id === user.id ? { ...u, plan: plan as User['plan'] } : u));
      showAlert(`Plano de ${user.full_name || user.email} alterado para ${plan}.`, 'success');
    } catch (e) { showAlert("Erro ao alterar plano.", 'error'); console.error(e); }
  }

  async function handleViewDetails(user: User) {
    setDetailUser(user);
    setLoadingDetail(true);
    try {
      const [activityRes, feedbackRes] = await Promise.all([
        api.get('/admin/activity', { params: { user_id: user.id, limit: 50 } }),
        api.get('/admin/feedback', { params: { user_id: user.id, limit: 50 } }),
      ]);
      setActivityEntries(activityRes.data.entries);
      setFeedbackEntries(feedbackRes.data.entries);
    } catch (e) {
      showAlert("Erro ao carregar detalhes do usuário.", 'error');
      console.error(e);
    } finally {
      setLoadingDetail(false);
    }
  }

  if (loading) return <div className="p-20 text-center text-zinc-500">Carregando usuários...</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Users className="h-7 w-7 text-red-500" /> Gestão de Usuários
        </h1>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou email..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-2 pl-9 pr-3 text-sm text-white outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      </div>

      <div className="bg-zinc-900 rounded-xl shadow-sm border border-zinc-800 overflow-hidden">
        <div className="p-5 border-b border-zinc-800 bg-zinc-950/50 flex items-center gap-2">
          <Users className="h-5 w-5 text-zinc-500" />
          <h2 className="font-semibold text-white">
            {search ? `${filteredUsers.length} de ${users.length} usuários` : `Base Total (${users.length})`}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-500 uppercase bg-zinc-900 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Nome</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4 text-center">Privilégio</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Plano</th>
                <th className="px-6 py-4">Último login</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="bg-zinc-900 border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-zinc-400">#{user.id}</td>
                  <td className="px-6 py-4 font-medium text-white">{user.full_name || 'Sem nome'}</td>
                  <td className="px-6 py-4 text-zinc-400 flex items-center gap-2">
                    <Mail className="h-3 w-3" /> {user.email}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {user.is_superuser ?
                      <span className="bg-red-900/30 text-red-400 text-xs px-2 py-1 rounded-full font-bold border border-red-800">ADMIN</span> :
                      <span className="bg-zinc-800 text-zinc-500 text-xs px-2 py-1 rounded-full">USER</span>
                    }
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => handleToggleStatus(user)} className="hover:scale-110 transition-transform" title="Clique para ativar/desativar">
                        {user.is_active ? <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto"/> : <XCircle className="h-5 w-5 text-zinc-400 mx-auto"/>}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <select
                      value={user.plan || 'starter'}
                      onChange={(e) => handleChangePlan(user, e.target.value)}
                      className="bg-zinc-800 border border-zinc-700 rounded-lg text-xs px-2 py-1.5 text-white outline-none"
                    >
                      <option value="starter">Starter</option>
                      <option value="plus">Plus</option>
                      <option value="pro">Pro</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-zinc-500 text-xs whitespace-nowrap">
                    {formatDateTime(user.last_login_at)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleViewDetails(user)} className="text-zinc-400 hover:text-white hover:bg-zinc-800 p-2 rounded transition-colors" title="Ver detalhes">
                          <Info className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggleAdmin(user)}
                        className={`p-2 rounded transition-colors ${user.is_superuser ? 'text-amber-500 hover:bg-amber-900/20' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                        title={user.is_superuser ? "Remover privilégio de admin" : "Promover a admin"}
                      >
                          {user.is_superuser ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                      </button>
                      {!user.is_superuser && (
                          <button onClick={() => handleDelete(user.id)} className="text-red-500 hover:bg-red-900/20 p-2 rounded transition-colors" title="Deletar Usuário">
                              <Trash2 className="h-4 w-4" />
                          </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-zinc-500">
                    Nenhum usuário encontrado pra "{search}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl border border-zinc-800 flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Info className="h-5 w-5 text-red-500" /> Detalhes do usuário
                </h3>
                <p className="text-xs text-zinc-500 mt-1">{detailUser.full_name || detailUser.email}</p>
              </div>
              <button onClick={() => setDetailUser(null)} className="text-zinc-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto">
              {/* INFO GERAL */}
              <div className="p-6 border-b border-zinc-800 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Email</p>
                  <p className="text-zinc-200">{detailUser.email}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Plano</p>
                  <p className="text-zinc-200 capitalize">{detailUser.plan || "starter"}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1"><Clock className="h-3 w-3" /> Último login</p>
                  <p className="text-zinc-200">{formatDateTime(detailUser.last_login_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Verificado</p>
                  <p className="text-zinc-200">{detailUser.is_verified ? "Sim" : "Não"}</p>
                </div>
              </div>

              {loadingDetail ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-red-500" />
                </div>
              ) : (
                <>
                  {/* ATIVIDADE */}
                  <div className="p-6 border-b border-zinc-800">
                    <h4 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-zinc-500" /> Atividade
                    </h4>
                    {activityEntries.length === 0 ? (
                      <p className="text-sm text-zinc-500">Nenhuma atividade registrada.</p>
                    ) : (
                      <div className="space-y-2">
                        {activityEntries.map((entry, i) => (
                          <div key={i} className="flex items-center justify-between text-sm border-b border-zinc-800 pb-2 last:border-0">
                            <span className="text-zinc-300">{EVENT_LABELS[entry.event_type] || entry.event_type}</span>
                            <span className="text-xs text-zinc-500">{formatDateTime(entry.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* CHAMADOS */}
                  <div className="p-6">
                    <h4 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                      <LifeBuoy className="h-4 w-4 text-zinc-500" /> Chamados
                    </h4>
                    {feedbackEntries.length === 0 ? (
                      <p className="text-sm text-zinc-500">Nenhum chamado aberto por esse usuário.</p>
                    ) : (
                      <div className="space-y-3">
                        {feedbackEntries.map((entry) => (
                          <div key={entry.id} className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-red-400">
                                {FEEDBACK_CATEGORY_LABELS[entry.category] || entry.category}
                              </span>
                              <span className="text-xs text-zinc-500">{formatDateTime(entry.created_at)}</span>
                            </div>
                            <p className="text-sm text-zinc-300">{entry.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
