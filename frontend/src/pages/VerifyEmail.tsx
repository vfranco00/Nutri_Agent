import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Mail,
} from "lucide-react";
import { LoadingOverlay } from "../components/LoadingOverlay";

type Status = "loading" | "success" | "error";

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<Status>("loading");
  const [resendEmail, setResendEmail] = useState("");
  const [resendSent, setResendSent] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      return;
    }
    api
      .get("/auth/verify-email", { params: { token } })
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [searchParams]);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    if (!resendEmail) return;
    setResending(true);
    try {
      await api.post("/auth/resend-verification", { email: resendEmail });
      setResendSent(true);
    } catch (err) {
      console.error(err);
      setResendSent(true); // resposta é sempre genérica no backend
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4 text-zinc-900 dark:text-zinc-100 transition-colors">
      {resending && <LoadingOverlay text="Reenviando o link de confirmação..." />}
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="h-10 w-10 text-green-500 animate-spin mx-auto mb-4" />
            <p className="text-zinc-500 dark:text-zinc-400">
              Confirmando seu email...
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-green-100 dark:bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-green-600 dark:text-green-500 mb-2">
              Email confirmado!
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mb-6">
              Sua conta já está ativa. Pode entrar normalmente.
            </p>
            <a
              href="/login"
              className="inline-block w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              Ir para o Login
            </a>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center">
              <XCircle className="h-7 w-7 text-red-600 dark:text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-red-600 dark:text-red-500 mb-2">
              Link inválido ou expirado
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mb-6">
              Peça um novo link de confirmação abaixo.
            </p>

            {resendSent ? (
              <p className="text-sm text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-500/10 py-3 rounded-lg border border-green-200 dark:border-green-500/20">
                Se o email existir e ainda não estiver confirmado, enviamos um
                novo link.
              </p>
            ) : (
              <form onSubmit={handleResend} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-zinc-400" />
                  <input
                    type="email"
                    required
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg py-2.5 pl-10 pr-4 focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resending}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {resending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "Reenviar link"
                  )}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
