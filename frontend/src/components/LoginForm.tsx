import { useState } from "react";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import { useAuth } from "../lib/AuthContext";
import { Lock, Mail, ArrowRight, RefreshCw } from "lucide-react";
import { PasswordInput } from "./PasswordInput";
import { BouncingDots } from "./BouncingDots";

/**
 * Só o miolo do login (cabeçalho + formulário + rodapé) — sem o card/fundo externo,
 * pra ser reaproveitado tanto na página /login quanto no modal de login da home.
 * Não faz o redirect pós-login: quem usa o componente observa `user` do AuthContext
 * e decide pra onde ir (evita a corrida de navegar antes do /users/me responder).
 */
export function LoginForm() {
  const { showAlert } = useAlert();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [resending, setResending] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setUnverifiedEmail("");

    try {
      const form = new FormData();
      form.append("username", email); // O FastAPI OAuth2 espera 'username'
      form.append("password", password);

      const response = await api.post("/auth/login", form);
      // login() atualiza o AuthContext; o container observa `user` e redireciona.
      login(response.data.access_token);
    } catch (err: any) {
      console.error(err);
      const detail = err.response?.data?.detail;
      if (detail?.code === "EMAIL_NOT_VERIFIED") {
        setError(detail.message || "Confirme seu email antes de entrar.");
        setUnverifiedEmail(email);
      } else if (detail?.code === "ACCOUNT_DISABLED") {
        setError(detail.message || "Sua conta foi desativada.");
      } else {
        setError("Email ou senha incorretos.");
      }
      setLoading(false); // Só para o loading se der erro (no sucesso, a tela troca)
    }
  }

  async function handleResendVerification() {
    setResending(true);
    try {
      await api.post("/auth/resend-verification", { email: unverifiedEmail });
      showAlert("Se o email existir e ainda não estiver confirmado, enviamos um novo link.", "success");
    } catch (err) {
      console.error(err);
      showAlert("Erro ao reenviar o link. Tente novamente.", "error");
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <div className="text-center mb-8">
        <img src="/nutri-agent-logo-horizontal.png" alt="NutriAgent" className="h-16 w-auto object-contain mx-auto mb-2" />
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
          <div className="flex items-center justify-between ml-1">
            <label className="text-sm font-medium text-zinc-300">Senha</label>
            <a href="/forgot-password" className="text-xs text-green-500 hover:text-green-400 hover:underline">
              Esqueceu a senha?
            </a>
          </div>
          <PasswordInput
            icon={<Lock className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg py-2.5 pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder-zinc-500 transition-all"
            placeholder="••••••••"
          />
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
                <RefreshCw className={`h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`} />
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
            <BouncingDots />
          ) : (
            <>
              Entrar
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 text-center text-sm text-zinc-500">
        Não tem uma conta?{" "}
        <a href="/register" className="text-green-500 hover:text-green-400 hover:underline">
          Crie agora
        </a>
      </div>
    </>
  );
}
