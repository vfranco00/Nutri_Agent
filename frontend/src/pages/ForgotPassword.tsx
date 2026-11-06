import { useState } from "react";
import { api } from "../lib/api";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { BouncingDots } from "../components/BouncingDots";
import { Button } from "../components/ui/Button";
import { AuthShell, AUTH_CAMPO, AUTH_ICONE, AUTH_LINK, AUTH_ROTULO } from "../components/auth/AuthShell";

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
    <AuthShell>
      {sent ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-pos-soft">
            <CheckCircle2 className="h-7 w-7 text-pos-text" />
          </div>
          <h1 className="mb-2 text-xl font-black tracking-tight text-ink">Verifique seu email</h1>
          <p className="mb-6 text-sm text-mut">
            Se <strong className="text-ink">{email}</strong> existir na nossa base, mandamos um link pra redefinir a senha. O link expira em 1 hora.
          </p>
          <a href="/?login=1" className={`inline-flex items-center gap-2 text-sm ${AUTH_LINK}`}>
            <ArrowLeft className="h-4 w-4" /> Voltar para o login
          </a>
        </div>
      ) : (
        <>
          <h1 className="mb-2 text-center text-xl font-black tracking-tight text-ink">Esqueceu a senha?</h1>
          <p className="mb-8 text-center text-sm text-mut">
            Digite seu email e mandamos um link pra você escolher uma nova senha.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="fp-email" className={AUTH_ROTULO}>Email</label>
              <div className="relative">
                <Mail className={AUTH_ICONE} />
                <input
                  id="fp-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={AUTH_CAMPO}
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <BouncingDots /> : "Enviar link"}
            </Button>
          </form>

          <div className="mt-8 text-center text-sm">
            <a href="/?login=1" className={`inline-flex items-center gap-1.5 ${AUTH_LINK}`}>
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar para o login
            </a>
          </div>
        </>
      )}
    </AuthShell>
  );
}
