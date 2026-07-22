import { useState } from "react";
import { api } from "../lib/api";
import {
  User,
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  CheckCircle2,
  MailCheck,
} from "lucide-react";
import { PasswordInput } from "../components/PasswordInput";
import { LoadingOverlay } from "../components/LoadingOverlay";

// A API pode devolver `detail` como string (erro de negócio) ou como lista de
// erros de validação do Pydantic (422) — trata os dois formatos com segurança
// pra nunca tentar renderizar um objeto direto no JSX.
function extractErrorMessage(err: any, fallback: string): string {
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const first = detail[0];
    return first?.msg || fallback;
  }
  return fallback;
}

export function Register() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registered, setRegistered] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState(""); // Novo estado

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validação local
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      setLoading(false);
      return;
    }

    try {
      await api.post("/users/", {
        full_name: name,
        email: email,
        password: password,
      });

      setRegistered(true);
    } catch (err: any) {
      console.error(err);
      setError(extractErrorMessage(err, "Erro ao criar conta."));
    } finally {
      setLoading(false);
    }
  }

  if (registered) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-900 rounded-xl shadow-2xl border border-zinc-800 p-8 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
            <MailCheck className="h-7 w-7 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-green-500 mb-2">
            Quase lá!
          </h1>
          <p className="text-zinc-400 mb-6">
            Enviamos um link de confirmação para <strong>{email}</strong>.
            Verifique sua caixa de entrada (e o spam) e confirme seu email
            antes de entrar.
          </p>
          <a
            href="/login"
            className="inline-block w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Ir para o Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      {loading && <LoadingOverlay text="Criando sua conta..." />}
      <div className="w-full max-w-md bg-zinc-900 rounded-xl shadow-2xl border border-zinc-800 p-8">
        <div className="text-center mb-8">
          <img src="/nutri-agent-logo-horizontal.png" alt="NutriAgent" className="h-16 w-auto object-contain mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-green-500 mb-2">
            Crie sua Conta
          </h1>
          <p className="text-zinc-400">
            Comece sua jornada saudável hoje
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300 ml-1">Nome Completo</label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder-zinc-500 transition-all"
                placeholder="Seu Nome"
              />
            </div>
          </div>

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
            <PasswordInput
              icon={<Lock className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg py-2.5 pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder-zinc-500 transition-all"
              placeholder="••••••••"
            />
          </div>

          {/* Campo Confirmar Senha */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300 ml-1">Confirmar Senha</label>
            <PasswordInput
              icon={<CheckCircle2 className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full bg-zinc-800 border text-zinc-100 rounded-lg py-2.5 pl-10 pr-10 focus:outline-none focus:ring-2 placeholder-zinc-500 transition-all
                ${
                  confirmPassword && password !== confirmPassword
                    ? "border-red-500 focus:ring-red-500"
                    : "border-zinc-700 focus:ring-green-500 focus:border-transparent"
                }`}
              placeholder="••••••••"
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-red-400 ml-1">
                As senhas não conferem.
              </p>
            )}
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
                Cadastrar <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-zinc-500">
          Já tem uma conta?{" "}
          <a
            href="/login"
            className="text-green-500 hover:text-green-400 hover:underline"
          >
            Fazer Login
          </a>
        </div>
      </div>
    </div>
  );
}
