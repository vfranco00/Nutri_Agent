import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { User } from '../types';
import { ArrowLeft, Shield, Trash2, Loader2, CheckCircle, XCircle } from 'lucide-react';

export function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUsers() {
      try {
        const response = await api.get('/admin/users');
        setUsers(response.data);
      } catch (error) {
        console.error("Erro ao carregar usuários", error);
        alert("Acesso negado: Você não é administrador.");
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, [navigate]);

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><Loader2 className="animate-spin text-green-500 h-8 w-8"/></div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-4">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <ArrowLeft className="h-6 w-6 text-zinc-400" />
          </button>
          <h1 className="text-2xl font-bold text-red-500 flex items-center gap-2">
            <Shield className="h-6 w-6" /> Painel Administrativo
          </h1>
        </div>

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-zinc-950 text-zinc-400 uppercase text-xs">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Nome</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Admin</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4 text-zinc-500">#{user.id}</td>
                  <td className="px-6 py-4 font-medium">{user.full_name}</td>
                  <td className="px-6 py-4 text-zinc-400">{user.email}</td>
                  <td className="px-6 py-4">
                    {user.is_active ? 
                      <span className="inline-flex items-center gap-1 text-green-400 text-xs bg-green-400/10 px-2 py-1 rounded-full">Ativo <CheckCircle className="h-3 w-3"/></span> : 
                      <span className="inline-flex items-center gap-1 text-red-400 text-xs bg-red-400/10 px-2 py-1 rounded-full">Inativo <XCircle className="h-3 w-3"/></span>
                    }
                  </td>
                  <td className="px-6 py-4">
                    {user.is_superuser ? 
                      <span className="text-red-400 font-bold text-xs border border-red-400/20 px-2 py-1 rounded">SUPERUSER</span> : 
                      <span className="text-zinc-600 text-xs">User</span>
                    }
                  </td>
                  <td className="px-6 py-4 text-right">
                    {!user.is_superuser && (
                      <button className="text-zinc-500 hover:text-red-500 transition-colors" title="Banir Usuário">
                        <Trash2 className="h-5 w-5" />
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