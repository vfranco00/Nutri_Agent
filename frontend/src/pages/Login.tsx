import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { LoginForm } from "../components/LoginForm";

/**
 * Página /login — mantida como fallback pra links diretos (voltar do cadastro,
 * confirmação de email, link de sessão). A entrada principal de login é o modal
 * na home (LoginModal). Reaproveita o mesmo LoginForm.
 */
export function Login() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Quando o login dá certo, `user` é preenchido pelo AuthContext e caímos aqui.
  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 rounded-xl shadow-2xl border border-zinc-800 p-8">
        <LoginForm />
      </div>
    </div>
  );
}
