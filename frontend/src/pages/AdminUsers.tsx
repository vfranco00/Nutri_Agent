import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { User } from '../types';
import { Shield, Users, Mail, CheckCircle2, XCircle } from 'lucide-react';

export function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await api.get('/users/');
        setUsers(res.data);
      } catch (error) {
        alert('Acesso negado: Você não é Admin.');
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, []);

  if (loading) return <div className="p-10 text-center">Carregando painel...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-red-600 mb-8 flex items-center gap-2">
        <Shield className="h-8 w-8" /> Painel Administrativo
      </h1>

      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 flex items-center gap-2">
          <Users className="h-5 w-5 text-zinc-500" />
          <h2 className="font-semibold dark:text-white">Usuários Cadastrados ({users.length})</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3">ID</th>
                <th className="px-6 py-3">Nome</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3 text-center">Admin?</th>
                <th className="px-6 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-6 py-4 font-mono text-zinc-400">#{user.id}</td>
                  <td className="px-6 py-4 font-medium dark:text-white">{user.full_name}</td>
                  <td className="px-6 py-4 text-zinc-500 flex items-center gap-2">
                    <Mail className="h-3 w-3" /> {user.email}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {user.is_superuser ? 
                      <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-bold">SIM</span> : 
                      <span className="text-zinc-300">-</span>
                    }
                  </td>
                  <td className="px-6 py-4 text-center">
                    {user.is_active ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto"/> : <XCircle className="h-4 w-4 text-red-500 mx-auto"/>}
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