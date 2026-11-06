import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import {
  User,
  Mail,
  Lock,
  ArrowRight,
  CheckCircle2,
  MailCheck,
} from "lucide-react";
import { POLICY_VERSION_ACEITA } from "../lib/consents";
import { PasswordInput } from "../components/PasswordInput";
import { BouncingDots } from "../components/BouncingDots";
import { Button } from "../components/ui/Button";
import { limparMensagemValidacao } from "../lib/mensagemValidacao";
import { AuthShell } from "../components/auth/AuthShell";
import { AUTH_CAMPO, AUTH_CAMPO_SENHA, AUTH_ERRO, AUTH_ICONE, AUTH_LINK, AUTH_ROTULO } from "../components/auth/authTheme";

// A API pode devolver `detail` como string (erro de negócio) ou como lista de
// erros de validação do Pydantic (422) — trata os dois formatos com segurança
// pra nunca tentar renderizar um objeto direto no JSX.
function extractErrorMessage(err: any, fallback: string): string {
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const first = detail[0];
    return limparMensagemValidacao(first?.msg) || fallback;
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
  const [aceitaPolitica, setAceitaPolitica] = useState(false);
  const [consenteSaude, setConsenteSaude] = useState(false);

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

    if (!aceitaPolitica || !consenteSaude) {
      setError("Para criar a conta, aceite a Política e autorize o uso dos dados de saúde.");
      setLoading(false);
      return;
    }

    try {
      await api.post("/users/", {
        full_name: name,
        email: email,
        password: password,
        accepted_policy_version: POLICY_VERSION_ACEITA,
        consent_saude: true,
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
      <AuthShell>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-pos-soft">
            <MailCheck className="h-7 w-7 text-pos-text" />
          </div>
          <h1 className="mb-2 text-2xl font-black tracking-tight text-ink">Quase lá!</h1>
          <p className="mb-6 text-mut">
            Enviamos um link de confirmação para <strong className="text-ink">{email}</strong>.
            Verifique sua caixa de entrada (e o spam) e confirme seu email
            antes de entrar.
          </p>
          <a
            href="/?login=1"
            className="inline-block w-full rounded-2xl bg-act py-3 text-sm font-extrabold text-nuvi-tinta"
          >
            Ir para o Login
          </a>
        </div>
      </AuthShell>
    );
  }

  const senhasDiferentes = Boolean(confirmPassword) && password !== confirmPassword;

  return (
    <AuthShell>
      <div className="mb-8 text-center">
        <h1 className="mb-1 text-[26px] font-black leading-tight tracking-tight text-ink">
          Crie sua <span className="text-act-text">conta</span>
        </h1>
        <p className="text-sm text-mut">Comece sua jornada saudável hoje</p>
      </div>

      <form onSubmit={handleRegister} className="space-y-5">
        <div className="space-y-2">
          <label className={AUTH_ROTULO}>Nome Completo</label>
          <div className="relative">
            <User className={AUTH_ICONE} />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={AUTH_CAMPO}
              placeholder="Seu Nome"
            />
          </div>
        </div>

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
          <label className={AUTH_ROTULO}>Senha</label>
          <PasswordInput
            icon={<Lock className={AUTH_ICONE} />}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={AUTH_CAMPO_SENHA}
            placeholder="••••••••"
          />
        </div>

        <div className="space-y-2">
          <label className={AUTH_ROTULO}>Confirmar Senha</label>
          <PasswordInput
            icon={<CheckCircle2 className={AUTH_ICONE} />}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`${AUTH_CAMPO_SENHA} ${senhasDiferentes ? "border-act-text" : ""}`}
            placeholder="••••••••"
          />
          {senhasDiferentes && <p className="ml-1 text-xs font-semibold text-act-text">As senhas não conferem.</p>}
        </div>

        <p className="ml-1 text-xs text-mut">Para maiores de 18 anos.</p>

        <label className="flex items-start gap-3 text-sm text-ink">
          <input type="checkbox" checked={aceitaPolitica} onChange={(e) => setAceitaPolitica(e.target.checked)} className="mt-0.5 h-5 w-5 accent-nuvi-laranja" />
          <span>
            Li e aceito a <Link to="/privacidade" target="_blank" className="font-extrabold text-act-text underline">Política de Privacidade</Link> e os{" "}
            <Link to="/termos" target="_blank" className="font-extrabold text-act-text underline">Termos de Uso</Link>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-2xl border-2 border-act bg-act-soft p-3 text-sm font-semibold text-ink">
          <input type="checkbox" checked={consenteSaude} onChange={(e) => setConsenteSaude(e.target.checked)} className="mt-0.5 h-5 w-5 accent-nuvi-laranja" />
          <span>Autorizo o tratamento dos meus dados de saúde (peso, medidas, diário) para calcular metas e registrar refeições</span>
        </label>

        {error && <div className={AUTH_ERRO}>{error}</div>}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? <BouncingDots /> : <>Cadastrar <ArrowRight className="h-5 w-5" /></>}
        </Button>
      </form>

      <div className="mt-8 text-center text-sm text-mut">
        Já tem uma conta?{" "}
        <a href="/?login=1" className={AUTH_LINK}>
          Fazer Login
        </a>
      </div>
    </AuthShell>
  );
}
