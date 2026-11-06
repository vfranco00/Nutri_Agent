import { useEffect, useLayoutEffect, useRef, type MouseEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { LoginModal } from "../components/LoginModal";
import { useAuthTheme } from "../components/auth/authTheme";
import { useFeedback } from "../lib/FeedbackContext";
import { ROUTES } from "../routes";
import html from "./landing/landing.html?raw";
import { iniciarLanding } from "./landing/landingScript";
import "./landing/landing.css";

/**
 * Landing do Nuvi. A marcação e as animações vêm de `docs/design/15-landing.html`
 * (aprovada pelo Franco): hero "Prato anotado" com foto e etiquetas da TACO, faixa de
 * comidas, demonstração "Fala que eu anoto", formas de registrar, planos e rodapé.
 * O conteúdo é estático e nosso; os links levam `data-acao` e são tratados aqui.
 */
export function Landing() {
  const navigate = useNavigate();
  const { openFeedbackModal } = useFeedback();
  const { user } = useAuth();
  useAuthTheme(); // o modal de login segue o tema salvo; a landing em si é sempre clara
  const [searchParams, setSearchParams] = useSearchParams();

  // O modal de login abre via ?login=1 (sessão expirada e redirecionamentos caem aqui).
  const loginOpen = searchParams.get("login") === "1";

  useEffect(() => {
    if (loginOpen && user) navigate(ROUTES.hoje, { replace: true });
  }, [loginOpen, user, navigate]);

  // A marcação é posta à mão (não por dangerouslySetInnerHTML) para que as animações
  // rodem sempre depois dela existir no DOM, inclusive no remonte do StrictMode.
  const conteudo = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = conteudo.current;
    if (!el) return;
    el.innerHTML = html;
    const parar = iniciarLanding();
    return () => {
      parar();
      el.innerHTML = "";
    };
  }, []);

  const closeLogin = () => setSearchParams({}, { replace: true });

  function onClick(e: MouseEvent<HTMLDivElement>) {
    const alvo = (e.target as HTMLElement).closest<HTMLElement>("[data-acao]");
    if (!alvo) return;
    const acao = alvo.dataset.acao;
    e.preventDefault();
    if (acao === "cadastrar") navigate("/register");
    else if (acao === "entrar") setSearchParams({ login: "1" });
    else if (acao === "ajuda") openFeedbackModal();
    else if (acao === "ir") navigate(alvo.getAttribute("href") ?? "/");
    else if (acao === "topo") window.scrollTo({ top: 0 });
    else if (acao?.startsWith("rolar-")) {
      document.getElementById(acao.slice(6))?.scrollIntoView({ behavior: "smooth" });
    }
  }

  // O LoginModal fica FORA do `.lp`: o CSS da landing é escopado nessa classe e,
  // dentro dela, desmontava os campos e botões do modal.
  return (
    <>
      <div className="lp" onClick={onClick}>
        <div ref={conteudo} />
      </div>
      <LoginModal open={loginOpen && !user} onClose={closeLogin} />
    </>
  );
}
