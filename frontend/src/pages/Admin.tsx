import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { User } from '../types';
import { Shield, Users, Mail, CheckCircle2, XCircle, ArrowLeft, Trash2, Power } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Admin() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const res = await api.get('/users/'); 
      setUsers(res.data);
    } catch (error) {
      alert('Acesso negado.');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if(!confirm("Tem certeza que deseja BANIR este usuário? Essa ação deleta tudo dele.")) return;
    try {
      await api.delete(`/users/${id}`);
      setUsers(users.filter(u => u.id !== id));
    } catch (e) { alert("Erro ao deletar."); }
  }

  async function handleToggleStatus(user: User) {
    try {
      await api.put(`/users/${user.id}/toggle-status`);
      setUsers(users.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u));
    } catch (e) { alert("Erro ao alterar status."); }
  }

  if (loading) return <div className="p-20 text-center text-zinc-500">Carregando painel...</div>;

  return (
    <div className="max-w-6xl mx-auto">
      <button onClick={() => navigate('/dashboard')} className="mb-6 flex items-center gap-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors">
        <ArrowLeft className="h-5 w-5" /> Voltar
      </button>

      <h1 className="text-3xl font-bold text-red-600 mb-8 flex items-center gap-3">
        <Shield className="h-8 w-8" /> Gestão de Usuários
      </h1>

      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 flex items-center gap-2">
          <Users className="h-5 w-5 text-zinc-500" />
          <h2 className="font-semibold dark:text-white">Base Total ({users.length})</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Nome</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4 text-center">Privilégio</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-zinc-400">#{user.id}</td>
                  <td className="px-6 py-4 font-medium dark:text-white">{user.full_name || 'Sem nome'}</td>
                  <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                    <Mail className="h-3 w-3" /> {user.email}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {user.is_superuser ? 
                      <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs px-2 py-1 rounded-full font-bold border border-red-200 dark:border-red-800">ADMIN</span> : 
                      <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-xs px-2 py-1 rounded-full">USER</span>
                    }
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => handleToggleStatus(user)} className="hover:scale-110 transition-transform" title="Clique para ativar/desativar">
                        {user.is_active ? <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto"/> : <XCircle className="h-5 w-5 text-zinc-400 mx-auto"/>}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {!user.is_superuser && (
                        <button onClick={() => handleDelete(user.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded transition-colors" title="Deletar Usuário">
                            <Trash2 className="h-4 w-4" />
                        </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}