import { useState } from "react";
import { api } from "../lib/api";
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { LoadingOverlay } from "../components/LoadingOverlay";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
    } catch (err) {
      console.error(err);
      // Resposta é sempre genérica no backend — mostra sucesso mesmo se der erro
      // de rede, pra não vazar se o email existe ou não.
    } finally {
      setSent(true);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      {loading && <LoadingOverlay text="Enviando o link de redefinição..." />}
      <div className="w-full max-w-md bg-zinc-900 rounded-xl shadow-2xl border border-zinc-800 p-8">
        <div className="text-center mb-8">
          <img src="/nutri-agent-logo-horizontal.png" alt="NutriAgent" className="h-20 w-auto object-contain mx-auto mb-2" />
        </div>

        {sent ? (
          <div className="text-center">
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-green-500" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Verifique seu email</h1>
            <p className="text-zinc-400 text-sm mb-6">
              Se <strong className="text-zinc-200">{email}</strong> existir na nossa base, mandamos um link pra redefinir a senha. O link expira em 1 hora.
            </p>
            <a href="/login" className="inline-flex items-center gap-2 text-green-500 hover:text-green-400 text-sm font-medium">
              <ArrowLeft className="h-4 w-4" /> Voltar para o login
            </a>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-white text-center mb-2">Esqueceu a senha?</h1>
            <p className="text-zinc-400 text-sm text-center mb-8">
              Digite seu email e mandamos um link pra você escolher uma nova senha.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
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

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Enviar link"}
              </button>
            </form>

            <div className="mt-8 text-center text-sm text-zinc-500">
              <a href="/login" className="text-green-500 hover:text-green-400 hover:underline inline-flex items-center gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar para o login
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
