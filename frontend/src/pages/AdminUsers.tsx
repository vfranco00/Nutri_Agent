import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAlert } from '../lib/AlertContext';
import type { User } from '../types';
import { Users, Mail, CheckCircle2, XCircle, Trash2, History, X, Loader2 } from 'lucide-react';

interface ActivityEntry {
  user_email: string;
  event_type: string;
  created_at: string;
}

const EVENT_LABELS: Record<string, string> = {
  chef_ai: "Chef IA",
  generate_plan_daily: "Cardápio diário",
  generate_plan_weekly: "Cardápio semanal",
  generate_plan_starter: "Cardápio (Starter)",
  meal_swap: "Troca de refeição",
};

export function AdminUsers() {
  const { showAlert, confirmDialog } = useAlert();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityUser, setActivityUser] = useState<User | null>(null);
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

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

  async function handleChangePlan(user: User, plan: string) {
    try {
      await api.put(`/users/${user.id}/subscription`, { plan });
      setUsers(users.map(u => u.id === user.id ? { ...u, plan: plan as User['plan'] } : u));
      showAlert(`Plano de ${user.full_name || user.email} alterado para ${plan}.`, 'success');
    } catch (e) { showAlert("Erro ao alterar plano.", 'error'); console.error(e); }
  }

  async function handleViewActivity(user: User) {
    setActivityUser(user);
    setLoadingActivity(true);
    try {
      const res = await api.get('/admin/activity', { params: { user_id: user.id, limit: 50 } });
      setActivityEntries(res.data.entries);
    } catch (e) {
      showAlert("Erro ao carregar atividade do usuário.", 'error');
      console.error(e);
    } finally {
      setLoadingActivity(false);
    }
  }

  if (loading) return <div className="p-20 text-center text-zinc-500">Carregando usuários...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
        <Users className="h-7 w-7 text-red-500" /> Gestão de Usuários
      </h1>

      <div className="bg-zinc-900 rounded-xl shadow-sm border border-zinc-800 overflow-hidden">
        <div className="p-5 border-b border-zinc-800 bg-zinc-950/50 flex items-center gap-2">
          <Users className="h-5 w-5 text-zinc-500" />
          <h2 className="font-semibold text-white">Base Total ({users.length})</h2>
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
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
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
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleViewActivity(user)} className="text-zinc-400 hover:text-white hover:bg-zinc-800 p-2 rounded transition-colors" title="Ver atividade">
                          <History className="h-4 w-4" />
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
            </tbody>
          </table>
        </div>
      </div>

      {activityUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl border border-zinc-800 flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <History className="h-5 w-5 text-red-500" /> Atividade
                </h3>
                <p className="text-xs text-zinc-500 mt-1">{activityUser.full_name || activityUser.email}</p>
              </div>
              <button onClick={() => setActivityUser(null)} className="text-zinc-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              {loadingActivity ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-red-500" />
                </div>
              ) : activityEntries.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">Nenhuma atividade registrada.</p>
              ) : (
                <div className="space-y-2">
                  {activityEntries.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between text-sm border-b border-zinc-800 pb-2 last:border-0">
                      <span className="text-zinc-300">{EVENT_LABELS[entry.event_type] || entry.event_type}</span>
                      <span className="text-xs text-zinc-500">
                        {new Date(entry.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
