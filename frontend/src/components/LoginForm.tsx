import { useState } from "react";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import { useAuth } from "../lib/AuthContext";
import { Lock, Mail, ArrowRight, RefreshCw } from "lucide-react";
import { PasswordInput } from "./PasswordInput";
import { BouncingDots } from "./BouncingDots";
import { Button } from "./ui/Button";
import { AUTH_CAMPO, AUTH_CAMPO_SENHA, AUTH_ERRO, AUTH_ICONE, AUTH_LINK, AUTH_ROTULO } from "./auth/authTheme";
import { NuviLogo } from "./brand/NuviLogo";

/**
 * Só o miolo do login (cabeçalho + formulário + rodapé) — sem o card/fundo externo.
 * Hoje é usado só pelo modal de login da home (LoginModal); login não tem tela própria.
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
      <div className="mb-8 text-center">
        <div className="mb-3 flex justify-center">
          <NuviLogo size={40} tone={document.documentElement.classList.contains("dark") ? "dark" : "light"} />
        </div>
        <p className="text-mut">Entre para gerenciar sua dieta</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-6">
        <div className="space-y-2">
          <label className={AUTH_ROTULO}>Email</label>
          <div className="relative">
            <Mail className={AUTH_ICONE} />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={AUTH_CAMPO}
              placeholder="seu@email.com"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className={AUTH_ROTULO}>Senha</label>
            <a href="/forgot-password" className={`text-xs ${AUTH_LINK}`}>
              Esqueceu a senha?
            </a>
          </div>
          <PasswordInput
            icon={<Lock className={AUTH_ICONE} />}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={AUTH_CAMPO_SENHA}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className={`${AUTH_ERRO} space-y-2`}>
            <p>{error}</p>
            {unverifiedEmail && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resending}
                className="inline-flex items-center gap-1.5 font-extrabold text-act-text disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`} />
                Reenviar email de confirmação
              </button>
            )}
          </div>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? (
            <BouncingDots />
          ) : (
            <>
              Entrar
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </Button>
      </form>

      <div className="mt-8 text-center text-sm text-mut">
        Não tem uma conta?{" "}
        <a href="/register" className={AUTH_LINK}>
          Crie agora
        </a>
        <p className="mt-3 text-xs">
          <a href="/privacidade" className="hover:underline">Política de Privacidade</a>
          {" · "}
          <a href="/termos" className="hover:underline">Termos de Uso</a>
        </p>
      </div>
    </>
  );
}
