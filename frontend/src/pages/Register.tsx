import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { User, Mail, Lock, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

export function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // Novo estado

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validação local
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      setLoading(false);
      return;
    }

    try {
      await api.post('/users/', {
        full_name: name,
        email: email,
        password: password
      });

      alert('Conta criada com sucesso! Faça login.');
      navigate('/login');

    } catch (err: any) {
      console.error(err);
      const message = err.response?.data?.detail || 'Erro ao criar conta.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4 text-zinc-900 dark:text-zinc-100 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-8">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-green-600 dark:text-green-500 mb-2">Crie sua Conta</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Comece sua jornada saudável hoje</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-5">
          
          <div className="space-y-2">
            <label className="text-sm font-medium ml-1">Nome Completo</label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-5 w-5 text-zinc-400" />
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg py-2.5 pl-10 pr-4 focus:ring-2 focus:ring-green-500 outline-none" placeholder="Seu Nome" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium ml-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-5 w-5 text-zinc-400" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg py-2.5 pl-10 pr-4 focus:ring-2 focus:ring-green-500 outline-none" placeholder="seu@email.com" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium ml-1">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-zinc-400" />
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg py-2.5 pl-10 pr-4 focus:ring-2 focus:ring-green-500 outline-none" placeholder="••••••••" />
            </div>
          </div>

          {/* Campo Confirmar Senha */}
          <div className="space-y-2">
            <label className="text-sm font-medium ml-1">Confirmar Senha</label>
            <div className="relative">
              <CheckCircle2 className="absolute left-3 top-3 h-5 w-5 text-zinc-400" />
              <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full bg-zinc-50 dark:bg-zinc-800 border rounded-lg py-2.5 pl-10 pr-4 focus:ring-2 outline-none transition-colors
                  ${confirmPassword && password !== confirmPassword 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-zinc-200 dark:border-zinc-700 focus:ring-green-500'}`} 
                placeholder="••••••••" />
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-red-500 ml-1">As senhas não conferem.</p>
            )}
          </div>

          {error && <div className="text-red-500 text-sm text-center bg-red-100 dark:bg-red-500/10 py-2 rounded-md border border-red-200 dark:border-red-500/20">{error}</div>}

          <button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Cadastrar <ArrowRight className="h-5 w-5" /></>}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-zinc-500">
          Já tem uma conta? <a href="/login" className="text-green-600 dark:text-green-500 hover:underline">Fazer Login</a>
        </div>
      </div>
    </div>
  );
}