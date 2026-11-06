import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { CheckCircle2, XCircle, Mail } from "lucide-react";
import { BouncingDots } from "../components/BouncingDots";
import { NuviLoader } from "../components/brand/NuviLoader";
import { Button } from "../components/ui/Button";
import { AuthShell, AUTH_CAMPO } from "../components/auth/AuthShell";

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
    <AuthShell>
      <div className="text-center">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <NuviLoader active size={56} label="Confirmando seu email" />
            <p className="text-mut">Confirmando seu email...</p>
          </div>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-pos-soft">
              <CheckCircle2 className="h-7 w-7 text-pos-text" />
            </div>
            <h1 className="mb-2 text-2xl font-black tracking-tight text-ink">Email confirmado!</h1>
            <p className="mb-6 text-mut">Sua conta já está ativa. Pode entrar normalmente.</p>
            <a
              href="/?login=1"
              className="inline-block w-full rounded-2xl bg-act py-3 text-sm font-extrabold text-nuvi-tinta"
            >
              Ir para o Login
            </a>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-act-soft">
              <XCircle className="h-7 w-7 text-act-text" />
            </div>
            <h1 className="mb-2 text-2xl font-black tracking-tight text-ink">Link inválido ou expirado</h1>
            <p className="mb-6 text-mut">Peça um novo link de confirmação abaixo.</p>

            {resendSent ? (
              <p className="rounded-2xl bg-pos-soft px-4 py-3 text-sm font-semibold text-ink">
                Se o email existir e ainda não estiver confirmado, enviamos um novo link.
              </p>
            ) : (
              <form onSubmit={handleResend} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-5 w-5 text-mut" />
                  <input
                    type="email"
                    required
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="seu@email.com"
                    aria-label="Email"
                    className={AUTH_CAMPO}
                  />
                </div>
                <Button type="submit" disabled={resending} className="w-full">
                  {resending ? <BouncingDots /> : "Reenviar link"}
                </Button>
              </form>
            )}
          </>
        )}
      </div>
    </AuthShell>
  );
}
