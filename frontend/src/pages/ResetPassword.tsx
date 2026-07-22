import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import { Lock, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { PasswordInput } from "../components/PasswordInput";

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
      setTimeout(() => navigate("/login"), 2000);
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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-900 rounded-xl shadow-2xl border border-zinc-800 p-8 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
            <XCircle className="h-7 w-7 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Link inválido</h1>
          <p className="text-zinc-400 text-sm mb-6">Esse link de redefinição de senha não é válido.</p>
          <a href="/forgot-password" className="text-green-500 hover:text-green-400 text-sm font-medium">
            Pedir um novo link
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 rounded-xl shadow-2xl border border-zinc-800 p-8">
        <div className="text-center mb-8">
          <img src="/nutri-agent-logo-horizontal.png" alt="NutriAgent" className="h-20 w-auto object-contain mx-auto mb-2" />
        </div>

        {success ? (
          <div className="text-center">
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-green-500" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Senha redefinida!</h1>
            <p className="text-zinc-400 text-sm">Te levando pro login...</p>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-white text-center mb-2">Escolha uma nova senha</h1>
            <p className="text-zinc-400 text-sm text-center mb-8">Mínimo de 8 caracteres.</p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300 ml-1">Nova senha</label>
                <PasswordInput
                  icon={<Lock className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg py-2.5 pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder-zinc-500 transition-all"
                  placeholder="••••••••"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300 ml-1">Confirmar nova senha</label>
                <PasswordInput
                  icon={<Lock className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg py-2.5 pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder-zinc-500 transition-all"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="text-red-400 text-sm text-center bg-red-400/10 py-2 rounded-md border border-red-400/20">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Redefinir senha"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
