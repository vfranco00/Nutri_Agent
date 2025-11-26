import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { User, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';

export function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Cria o usuário
      await api.post('/users/', {
        full_name: name,
        email: email,
        password: password
      });

      // 2. Se deu certo, redireciona pro login
      alert('Conta criada com sucesso! Faça login.');
      navigate('/login');

    } catch (err: any) {
      console.error(err);
      // Tenta pegar a mensagem de erro da API (ex: Email already registered)
      const message = err.response?.data?.detail || 'Erro ao criar conta.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 rounded-xl shadow-2xl border border-zinc-800 p-8">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-green-500 mb-2">Crie sua Conta</h1>
          <p className="text-zinc-400">Comece sua jornada saudável hoje</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
          
          {/* Nome */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300 ml-1">Nome Completo</label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                placeholder="Seu Nome"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300 ml-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                placeholder="seu@email.com"
              />
            </div>
          </div>

          {/* Senha */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300 ml-1">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center bg-red-400/10 py-2 rounded-md border border-red-400/20">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                Cadastrar
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-zinc-500">
          Já tem uma conta?{' '}
          <a href="/login" className="text-green-500 hover:text-green-400 hover:underline">
            Fazer Login
          </a>
        </div>
      </div>
    </div>
  );
}