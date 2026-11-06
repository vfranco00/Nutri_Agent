import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { LoginModal } from "../components/LoginModal";
import { NuviLogo } from "../components/brand/NuviLogo";
import { NuviSlice } from "../components/brand/NuviSlice";
import { Button } from "../components/ui/Button";
import { useAuthTheme } from "../components/auth/authTheme";
import { ROUTES } from "../routes";
import {
  Book,
  CheckCheck,
  ChefHat,
  ShoppingCart,
  CalendarRange,
  ArrowRight,
  Check,
  Plus,
  Minus,
  Flame,
  Target,
  Scale,
  MessageCircleQuestionIcon
} from "lucide-react";
import { useFeedback } from "../lib/FeedbackContext";

const FEATURES = [
  {
    n: "01",
    tag: "RECEITAS",
    icon: Book,
    title: "Suas receitas, organizadas de verdade",
    description:
      "Cadastre suas próprias receitas ou aproveite as da comunidade. Cada receita mostra calorias, ingredientes e modo de preparo — e deixa claro quando foi criada por IA.",
  },
  {
    n: "02",
    tag: "CARDÁPIO",
    icon: CheckCheck,
    title: "Cardápio gerado pra você, não genérico",
    description:
      "A IA monta um cardápio diário ou semanal com base no seu perfil — idade, peso, objetivo e preferências alimentares.",
  },
  {
    n: "03",
    tag: "CHEF IA",
    icon: ChefHat,
    title: "Tem ingredientes? A IA vira eles receita",
    description:
      "Diga o que sobrou na geladeira e a IA cria uma receita completa na hora, com calorias e modo de preparo passo a passo.",
  },
  {
    n: "04",
    tag: "COMPRAS",
    icon: ShoppingCart,
    title: "Lista de compras direto do cardápio",
    description:
      "Gerou o cardápio da semana? A gente já monta a lista de compras consolidada — sem contar ingrediente repetido na mão.",
  },
  {
    n: "05",
    tag: "PLANOS ALIMENTARES — O MAIS USADO",
    icon: CalendarRange,
    title: "Salve o cardápio ou monte o seu, com suas receitas",
    description:
      "Guarde os cardápios que a IA gerou ou monte o seu do zero escolhendo entre suas receitas e as da comunidade — dia por dia, refeição por refeição.",
    highlight: true,
  },
];

const OBJECTION_FAQ = [
  {
    q: "Preciso saber calcular caloria pra usar?",
    a: "Não. A gente já busca as calorias numa base de alimentos brasileira (TACO) e complementa com IA quando precisa — você só escolhe o que vai comer.",
  },
  {
    q: "Funciona pra qualquer objetivo?",
    a: "Sim. Perder peso, ganhar massa ou manter — o cardápio e as calorias diárias se ajustam ao seu perfil e objetivo.",
  },
  {
    q: "Preciso pagar pra começar?",
    a: "Não. O plano Starter é grátis e já gera cardápio, usa o Chef IA e salva receitas. Upgrade só quando quiser mais.",
  },
  {
    q: "Meus dados ficam seguros?",
    a: "Sim. Seu perfil, receitas e histórico são seus — visíveis só pra você, exceto o que você mesmo decide compartilhar com a comunidade.",
  },
];

const FAQ_ITEMS = [
  {
    q: "O Nuvi substitui um nutricionista?",
    a: "Não. O Nuvi te ajuda a organizar e planejar sua alimentação no dia a dia, mas não substitui acompanhamento profissional — principalmente se você tem alguma condição de saúde específica.",
  },
  {
    q: "Funciona pra dieta vegetariana, vegana ou restrições alimentares?",
    a: "Sim. No seu perfil você define tipo de dieta, alergias e o que gosta ou não de comer — o cardápio gerado pela IA respeita isso.",
  },
  {
    q: "Preciso instalar algum aplicativo?",
    a: "Não. O Nuvi roda direto no navegador, no computador ou no celular, sem instalação.",
  },
  {
    q: "Como funciona o Chef IA?",
    a: "Você digita os ingredientes que tem disponíveis e a IA monta uma receita completa na hora, com quantidades, modo de preparo e calorias estimadas.",
  },
  {
    q: "Posso trocar de plano depois?",
    a: "Sim, você pode fazer upgrade a qualquer momento pela tela de Assinatura, direto no app.",
  },
];

function DashboardMockup() {
  return (
    <div className="overflow-hidden rounded-3xl bg-card text-ink">
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-mut">Olá, visitante</p>
            <p className="text-sm font-semibold text-ink">Seu resumo de hoje</p>
          </div>
          <NuviSlice size={28} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-soft p-3 text-center">
            <Flame className="mx-auto mb-1 h-4 w-4 text-act-text" />
            <p className="text-lg font-black">1.850</p>
            <p className="text-[10px] font-bold uppercase text-mut">Kcal hoje</p>
          </div>
          <div className="rounded-2xl bg-soft p-3 text-center">
            <Target className="mx-auto mb-1 h-4 w-4 text-act-text" />
            <p className="text-lg font-black">3</p>
            <p className="text-[10px] font-bold uppercase text-mut">Refeições</p>
          </div>
          <div className="rounded-2xl bg-soft p-3 text-center">
            <Scale className="mx-auto mb-1 h-4 w-4 text-pos-text" />
            <p className="text-lg font-black">-2,3kg</p>
            <p className="text-[10px] font-bold uppercase text-mut">No mês</p>
          </div>
        </div>
        <div className="rounded-2xl bg-act-soft p-4">
          <p className="mb-2 text-xs font-black uppercase text-act-text">Almoço sugerido pela IA</p>
          <p className="text-sm text-ink">Frango grelhado com arroz integral e brócolis no vapor</p>
        </div>
      </div>
    </div>
  );
}

export function Landing() {
  const navigate = useNavigate();
  const { openFeedbackModal } = useFeedback();
  const { user } = useAuth();
  const dark = useAuthTheme();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [searchParams, setSearchParams] = useSearchParams();

  // O modal de login abre via ?login=1 (assim redirecionamentos como sessão expirada
  // podem cair na home já com a caixa aberta). Usuário já logado que cai aqui vai
  // direto pro Hoje em vez de ver o modal.
  const loginOpen = searchParams.get("login") === "1";

  useEffect(() => {
    if (loginOpen && user) {
      navigate(ROUTES.hoje, { replace: true });
    }
  }, [loginOpen, user, navigate]);

  const openLogin = () => setSearchParams({ login: "1" });
  const closeLogin = () => setSearchParams({}, { replace: true });
  const cadastrar = () => navigate("/register");

  const secao = "mx-auto max-w-6xl border-t border-line px-4 py-16 sm:px-6 sm:py-20";
  const sobretitulo = "mb-3 text-xs font-extrabold uppercase tracking-widest text-act-text";

  return (
    <div className="min-h-screen bg-bg text-ink">
      <LoginModal open={loginOpen && !user} onClose={closeLogin} />
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-line bg-bg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <NuviLogo size={28} tone={dark ? "dark" : "light"} />
          <nav className="hidden items-center gap-8 text-sm font-semibold text-mut md:flex">
            <a href="#produto" className="hover:text-ink">Produto</a>
            <a href="#recursos" className="hover:text-ink">Recursos</a>
            <a href="#planos" className="hover:text-ink">Planos</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={openLogin} className="px-2 text-sm font-bold text-mut hover:text-ink">
              Entrar
            </button>
            <Button onClick={cadastrar} className="px-4 py-2.5">
              Começar grátis
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:pt-16">
        <div>
          <p className={sobretitulo}>NUVI · nutrição inteligente com IA</p>
          <h1 className="mb-6 text-4xl font-black leading-[1.05] tracking-[-0.025em] sm:text-5xl">
            Sua alimentação, planejada por IA — não numa <span className="text-act-text">planilha de dieta</span>.
          </h1>
          <p className="mb-8 text-lg leading-relaxed text-mut">
            Gere cardápios personalizados, crie receitas com o que você tem na geladeira e organize sua lista de
            compras — tudo num só lugar, ajustado ao seu perfil e objetivo.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Button onClick={cadastrar} className="px-6 py-3.5 text-base">
              Começar grátis <ArrowRight className="h-4 w-4" />
            </Button>
            <a href="#planos" className="flex items-center gap-1 text-sm font-extrabold text-act-text hover:underline">
              Ver planos →
            </a>
          </div>
          <p className="mt-6 text-xs text-mut">
            Qualquer objetivo — perder peso, ganhar massa ou manter. O cardápio se adapta a você.
          </p>
        </div>
        <div className="relative rounded-[2rem] bg-nuvi-laranja p-5 sm:p-8">
          <div className="mb-4 flex justify-center">
            <NuviSlice size={72} tone="onOrange" />
          </div>
          <DashboardMockup />
        </div>
      </section>

      {/* PRODUTO */}
      <section id="produto" className={secao}>
        <p className={sobretitulo}>01–05 · produto</p>
        <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <h2 className="max-w-md text-3xl font-black tracking-tight sm:text-4xl">
            Cinco peças que resolvem sua alimentação de verdade
          </h2>
          <p className="max-w-sm text-sm text-mut">
            Do cardápio da semana à lista de compras — cada parte foi pensada pro seu dia a dia, não pra um app
            genérico de contagem de calorias.
          </p>
        </div>

        <div id="recursos" className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.n}
              className={`rounded-3xl p-6 ${f.highlight ? "border-2 border-act bg-card md:col-span-2" : "border border-line bg-card"}`}
            >
              <p className="mb-3 text-xs font-bold text-mut">{f.n} {f.tag}</p>
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-act-soft">
                <f.icon className="h-5 w-5 text-act-text" />
              </div>
              <h3 className="mb-2 text-lg font-extrabold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-mut">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* INSTALAÇÃO */}
      <section className={`${secao} grid grid-cols-1 items-center gap-12 lg:grid-cols-2`}>
        <div>
          <p className={sobretitulo}>acesso</p>
          <h2 className="mb-4 text-3xl font-black tracking-tight">Funciona no navegador. No computador ou no celular.</h2>
          <p className="mb-6 text-mut">
            Não precisa instalar nada pra começar — abre direto no navegador, de qualquer lugar.
          </p>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-2"><span className="text-mut">—</span> Funciona igual no computador e no celular.</li>
            <li className="flex gap-2"><span className="text-mut">—</span> Mesmo login, mesmos dados, em qualquer aparelho.</li>
            <li className="flex gap-2"><span className="text-mut">—</span> Sem instalação obrigatória, sem mexer com TI.</li>
          </ul>
        </div>
        <div className="flex items-center justify-center rounded-3xl bg-nuvi-laranja p-8">
          <NuviSlice size={96} tone="onOrange" />
        </div>
      </section>

      {/* FAQ OBJEÇÃO */}
      <section className={secao}>
        <p className={sobretitulo}>antes de decidir</p>
        <h2 className="mb-10 max-w-lg text-3xl font-black tracking-tight">Perguntas de quem já tentou dieta em planilha</h2>
        <div className="grid grid-cols-1 overflow-hidden rounded-3xl border border-line bg-card md:grid-cols-2">
          {OBJECTION_FAQ.map((item, i) => (
            <div key={item.q} className={`border-line p-6 ${i % 2 === 0 ? "md:border-r" : ""} ${i < 2 ? "border-b" : ""} ${i === 2 ? "max-md:border-b" : ""}`}>
              <p className="mb-2 text-xs font-bold text-mut">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mb-2 font-extrabold">{item.q}</h3>
              <p className="text-sm leading-relaxed text-mut">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" className={secao}>
        <p className={sobretitulo}>planos</p>
        <h2 className="mb-10 max-w-lg text-3xl font-black tracking-tight">Um plano pro tamanho da sua rotina</h2>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="flex flex-col rounded-3xl border border-line bg-card p-6">
            <h3 className="mb-1 font-extrabold">Starter</h3>
            <p className="mb-4 text-2xl font-black">Grátis</p>
            <p className="mb-6 text-sm text-mut">Pra quem quer começar a organizar a própria alimentação sem compromisso.</p>
            <ul className="mb-8 flex-1 space-y-2 text-sm">
              {["2 cardápios por mês", "Chef IA 5x por semana", "Até 5 planos alimentares salvos", "Até 10 receitas próprias salvas"].map((t) => (
                <li key={t} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-pos-text" /> {t}</li>
              ))}
            </ul>
            <Button variant="outline" onClick={cadastrar}>Começar grátis</Button>
          </div>

          <div className="relative flex flex-col rounded-3xl border-2 border-act bg-card p-6">
            <span className="absolute -top-3 left-6 rounded-md bg-act-soft px-2 py-1 text-[10px] font-black uppercase tracking-wide text-act-text">
              Mais popular
            </span>
            <h3 className="mb-1 font-extrabold">Plus</h3>
            <p className="mb-4 text-2xl font-black">R$ 29,90<span className="text-sm font-semibold text-mut">/mês</span></p>
            <p className="mb-6 text-sm text-mut">Pra quem já usa toda semana e quer lista de compras liberada.</p>
            <ul className="mb-8 flex-1 space-y-2 text-sm">
              {["1 cardápio semanal + diário todo dia", "Chef IA 30x por mês", "Lista de compras liberada", "Até 30 planos alimentares salvos", "Até 50 receitas próprias salvas"].map((t) => (
                <li key={t} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-pos-text" /> {t}</li>
              ))}
            </ul>
            <Button onClick={cadastrar}>Começar grátis</Button>
          </div>

          <div className="flex flex-col rounded-3xl border border-line bg-card p-6">
            <h3 className="mb-1 font-extrabold">Pro</h3>
            <p className="mb-4 text-2xl font-black">R$ 59,90<span className="text-sm font-semibold text-mut">/mês</span></p>
            <p className="mb-6 text-sm text-mut">Uso ilimitado de tudo, sem se preocupar com limite nenhum.</p>
            <ul className="mb-8 flex-1 space-y-2 text-sm">
              {["Cardápios ilimitados", "Chef IA ilimitado", "Planos alimentares ilimitados", "Receitas próprias ilimitadas"].map((t) => (
                <li key={t} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-pos-text" /> {t}</li>
              ))}
            </ul>
            <Button variant="outline" onClick={cadastrar}>Começar grátis</Button>
          </div>
        </div>
      </section>

      {/* FAQ ACORDEÃO */}
      <section className="mx-auto max-w-3xl border-t border-line px-4 py-16 sm:px-6 sm:py-20">
        <p className={sobretitulo}>faq</p>
        <h2 className="mb-10 text-3xl font-black tracking-tight">Perguntas frequentes</h2>
        <div className="divide-y divide-line border-y border-line">
          {FAQ_ITEMS.map((item, i) => (
            <div key={item.q}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                aria-expanded={openFaq === i}
                className="flex w-full items-center justify-between gap-4 py-5 text-left"
              >
                <span className="font-bold">{item.q}</span>
                {openFaq === i ? <Minus className="h-4 w-4 shrink-0 text-mut" /> : <Plus className="h-4 w-4 shrink-0 text-mut" />}
              </button>
              {openFaq === i && <p className="pb-5 text-sm leading-relaxed text-mut">{item.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* AJUDA & FEEDBACK */}
      <section className="mx-auto max-w-3xl border-t border-line px-4 py-16 text-center sm:px-6">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-act-soft">
          <MessageCircleQuestionIcon className="h-7 w-7 text-act-text" />
        </div>
        <h2 className="mb-3 text-2xl font-black tracking-tight sm:text-3xl">Precisa de ajuda?</h2>
        <p className="mx-auto mb-6 max-w-md text-mut">
          Achou um bug, tem uma dúvida ou uma ideia pro Nuvi? Manda pra gente — a
          bolinha no canto da tela abre esse mesmo formulário em qualquer página.
        </p>
        <Button variant="outline" onClick={openFeedbackModal} className="px-6 py-3.5">
          <MessageCircleQuestionIcon className="h-5 w-5 text-act-text" /> Falar com a gente
        </Button>
      </section>

      {/* CTA FINAL */}
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-8 rounded-[2rem] bg-nuvi-laranja p-8 text-nuvi-tinta sm:flex-row sm:p-14">
          <div>
            <p className="mb-3 text-xs font-extrabold uppercase tracking-widest">Comece hoje</p>
            <h2 className="max-w-md text-3xl font-black leading-tight tracking-tight">
              Chega de planilha de dieta. Planeje sua alimentação de verdade.
            </h2>
          </div>
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={cadastrar}
              className="whitespace-nowrap rounded-2xl bg-nuvi-tinta px-6 py-3.5 text-sm font-extrabold text-nuvi-creme"
            >
              Começar grátis
            </button>
            <a href="#planos" className="text-sm font-bold underline">Ver planos</a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-8 border-t border-line">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-12 sm:grid-cols-4 sm:px-6">
          <div className="col-span-2 sm:col-span-1">
            <div className="mb-3">
              <NuviLogo size={22} tone={dark ? "dark" : "light"} />
            </div>
            <p className="text-sm text-mut">Nutrição inteligente com IA pro seu dia a dia.</p>
          </div>
          <div>
            <p className="mb-3 text-xs font-extrabold uppercase text-mut">Produto</p>
            <ul className="space-y-2 text-sm">
              <li><a href="#recursos" className="hover:underline">Recursos</a></li>
              <li><a href="#planos" className="hover:underline">Planos</a></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-xs font-extrabold uppercase text-mut">Conta</p>
            <ul className="space-y-2 text-sm">
              <li><button onClick={openLogin} className="hover:underline">Entrar</button></li>
              <li><button onClick={cadastrar} className="hover:underline">Criar conta</button></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-xs font-extrabold uppercase text-mut">Nuvi</p>
            <ul className="mb-3 space-y-2 text-sm">
              <li><a href="/privacidade" className="hover:underline">Política de Privacidade</a></li>
              <li><a href="/termos" className="hover:underline">Termos de Uso</a></li>
            </ul>
            <p className="text-sm text-mut">© {new Date().getFullYear()} Nuvi</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
