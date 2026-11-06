import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import { Lock, CheckCircle2, XCircle } from "lucide-react";
import { PasswordInput } from "../components/PasswordInput";
import { BouncingDots } from "../components/BouncingDots";
import { Button } from "../components/ui/Button";
import { AuthShell, AUTH_CAMPO_SENHA, AUTH_ERRO, AUTH_ICONE, AUTH_LINK, AUTH_ROTULO } from "../components/auth/AuthShell";

export function ResetPassword() {
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: newPassword });
      setSuccess(true);
      showAlert("Senha redefinida com sucesso!", "success");
      setTimeout(() => navigate("/?login=1"), 2000);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Link inválido ou expirado. Peça um novo.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthShell>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-act-soft">
            <XCircle className="h-7 w-7 text-act-text" />
          </div>
          <h1 className="mb-2 text-xl font-black tracking-tight text-ink">Link inválido</h1>
          <p className="mb-6 text-sm text-mut">Esse link de redefinição de senha não é válido.</p>
          <a href="/forgot-password" className={`text-sm ${AUTH_LINK}`}>
            Pedir um novo link
          </a>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      {success ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-pos-soft">
            <CheckCircle2 className="h-7 w-7 text-pos-text" />
          </div>
          <h1 className="mb-2 text-xl font-black tracking-tight text-ink">Senha redefinida!</h1>
          <p className="text-sm text-mut">Te levando pro login...</p>
        </div>
      ) : (
        <>
          <h1 className="mb-2 text-center text-xl font-black tracking-tight text-ink">Escolha uma nova senha</h1>
          <p className="mb-8 text-center text-sm text-mut">Mínimo de 8 caracteres.</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className={AUTH_ROTULO}>Nova senha</label>
              <PasswordInput
                icon={<Lock className={AUTH_ICONE} />}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={AUTH_CAMPO_SENHA}
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-2">
              <label className={AUTH_ROTULO}>Confirmar nova senha</label>
              <PasswordInput
                icon={<Lock className={AUTH_ICONE} />}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={AUTH_CAMPO_SENHA}
                placeholder="••••••••"
              />
            </div>

            {error && <div className={AUTH_ERRO}>{error}</div>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <BouncingDots /> : "Redefinir senha"}
            </Button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
