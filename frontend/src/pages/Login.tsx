import { useState, useEffect } from 'react'; // Adicione useEffect
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAlert } from '../lib/AlertContext';
import { Lock, Mail, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

export function Login() {
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resending, setResending] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { login, user } = useAuth(); // Pegue o user do contexto

  // --- CORREÇÃO DO LOOP DE LOGIN ---
  // Se o usuário já existe (está logado), manda pro Dashboard.
  // Isso resolve o problema de clicar em "Voltar" e cair no login.
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(''); // Limpa erros anteriores
    setUnverifiedEmail('');

    try {
      const form = new FormData();
      form.append('username', email); // O FastAPI OAuth2 espera 'username'
      form.append('password', password);

      const response = await api.post('/auth/login', form);

      // A função login do contexto vai atualizar o estado 'user'
      // O useEffect acima vai perceber a mudança e redirecionar
      login(response.data.access_token);

    } catch (err: any) {
      console.error(err);
      const detail = err.response?.data?.detail;
      if (detail?.code === 'EMAIL_NOT_VERIFIED') {
        setError(detail.message || 'Confirme seu email antes de entrar.');
        setUnverifiedEmail(email);
      } else if (detail?.code === 'ACCOUNT_DISABLED') {
        setError(detail.message || 'Sua conta foi desativada.');
      } else {
        setError('Email ou senha incorretos.');
      }
      setLoading(false); // Só para o loading se der erro
    }
  }

  async function handleResendVerification() {
    setResending(true);
    try {
      await api.post('/auth/resend-verification', { email: unverifiedEmail });
      showAlert('Se o email existir e ainda não estiver confirmado, enviamos um novo link.', 'success');
    } catch (err) {
      console.error(err);
      showAlert('Erro ao reenviar o link. Tente novamente.', 'error');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 rounded-xl shadow-2xl border border-zinc-800 p-8">
        
        <div className="text-center mb-8">
          <img src="/nutri_agent_logo.png" alt="NutriAgent" className="h-20 w-auto object-contain mx-auto mb-2" />
          <p className="text-zinc-400">Entre para gerenciar sua dieta</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300 ml-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder-zinc-500 transition-all"
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300 ml-1">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder-zinc-500 transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center bg-red-400/10 py-2 rounded-md border border-red-400/20 space-y-2">
              <p>{error}</p>
              {unverifiedEmail && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resending}
                  className="inline-flex items-center gap-1.5 text-green-400 hover:text-green-300 font-medium disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} />
                  Reenviar email de confirmação
                </button>
              )}
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
                Entrar
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-zinc-500">
          Não tem uma conta?{' '}
          <a href="/register" className="text-green-500 hover:text-green-400 hover:underline">
            Crie agora
          </a>
        </div>
      </div>
    </div>
  );
}