import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Sparkles,
  Flame,
  Target,
  Scale,
  Bot,
} from "lucide-react";

const FEATURES = [
  {
    n: "01",
    tag: "RECEITAS",
    icon: Book,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    title: "Suas receitas, organizadas de verdade",
    description:
      "Cadastre suas próprias receitas ou aproveite as da comunidade. Cada receita mostra calorias, ingredientes e modo de preparo — e deixa claro quando foi criada por IA.",
  },
  {
    n: "02",
    tag: "CARDÁPIO",
    icon: CheckCheck,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    title: "Cardápio gerado pra você, não genérico",
    description:
      "A IA monta um cardápio diário ou semanal com base no seu perfil — idade, peso, objetivo e preferências alimentares.",
  },
  {
    n: "03",
    tag: "CHEF IA",
    icon: ChefHat,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    title: "Tem ingredientes? A IA vira eles receita",
    description:
      "Diga o que sobrou na geladeira e a IA cria uma receita completa na hora, com calorias e modo de preparo passo a passo.",
  },
  {
    n: "04",
    tag: "COMPRAS",
    icon: ShoppingCart,
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    title: "Lista de compras direto do cardápio",
    description:
      "Gerou o cardápio da semana? A gente já monta a lista de compras consolidada — sem contar ingrediente repetido na mão.",
  },
  {
    n: "05",
    tag: "PLANOS ALIMENTARES — O MAIS USADO",
    icon: CalendarRange,
    color: "text-teal-400",
    bg: "bg-teal-500/10",
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
    q: "O NutriAgent substitui um nutricionista?",
    a: "Não. O NutriAgent te ajuda a organizar e planejar sua alimentação no dia a dia, mas não substitui acompanhamento profissional — principalmente se você tem alguma condição de saúde específica.",
  },
  {
    q: "Funciona pra dieta vegetariana, vegana ou restrições alimentares?",
    a: "Sim. No seu perfil você define tipo de dieta, alergias e o que gosta ou não de comer — o cardápio gerado pela IA respeita isso.",
  },
  {
    q: "Preciso instalar algum aplicativo?",
    a: "Não. O NutriAgent roda direto no navegador, no computador ou no celular, sem instalação.",
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
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-950/50">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
        </div>
        <span className="text-xs text-zinc-500 ml-2">nutriagent.app/dashboard</span>
      </div>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Olá, visitante 👋</p>
            <p className="text-sm text-zinc-300">Seu resumo de hoje</p>
          </div>
          <Bot className="h-6 w-6 text-green-500" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-center">
            <Flame className="h-4 w-4 text-red-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-white">1.850</p>
            <p className="text-[10px] text-zinc-500 uppercase">Kcal hoje</p>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-center">
            <Target className="h-4 w-4 text-purple-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-white">3</p>
            <p className="text-[10px] text-zinc-500 uppercase">Refeições</p>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-center">
            <Scale className="h-4 w-4 text-blue-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-white">-2,3kg</p>
            <p className="text-[10px] text-zinc-500 uppercase">No mês</p>
          </div>
        </div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
          <p className="text-xs text-purple-400 font-bold uppercase mb-2">Almoço sugerido pela IA</p>
          <p className="text-sm text-zinc-300">Frango grelhado com arroz integral e brócolis no vapor</p>
        </div>
      </div>
    </div>
  );
}

export function Landing() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="bg-zinc-950 text-zinc-100 min-h-screen">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <img src="/nutri-agent-logo-horizontal.png" alt="NutriAgent" className="h-8 w-auto object-contain" />
          <nav className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
            <a href="#produto" className="hover:text-white transition-colors">Produto</a>
            <a href="#recursos" className="hover:text-white transition-colors">Recursos</a>
            <a href="#planos" className="hover:text-white transition-colors">Planos</a>
          </nav>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/login")} className="text-sm text-zinc-400 hover:text-white transition-colors">
              Entrar
            </button>
            <button
              onClick={() => navigate("/register")}
              className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
            >
              Começar grátis
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-green-500 mb-4">
            — NUTRIAGENT · NUTRIÇÃO INTELIGENTE COM IA
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-6">
            Sua alimentação, planejada por IA — não numa planilha de dieta.
          </h1>
          <p className="text-zinc-400 text-lg mb-8 leading-relaxed">
            Gere cardápios personalizados, crie receitas com o que você tem na geladeira e organize sua lista de
            compras — tudo num só lugar, ajustado ao seu perfil e objetivo.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => navigate("/register")}
              className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3.5 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-green-900/30"
            >
              Começar grátis <ArrowRight className="h-4 w-4" />
            </button>
            <a href="#planos" className="text-sm text-zinc-300 hover:text-white font-medium flex items-center gap-1">
              Ver planos →
            </a>
          </div>
          <p className="text-xs text-zinc-500 mt-6">
            Qualquer objetivo — perder peso, ganhar massa ou manter. O cardápio se adapta a você.
          </p>
        </div>
        <DashboardMockup />
      </section>

      {/* PRODUTO */}
      <section id="produto" className="max-w-6xl mx-auto px-4 sm:px-6 py-20 border-t border-zinc-900">
        <p className="text-xs font-bold uppercase tracking-widest text-green-500 mb-3">— 01–05 PRODUTO</p>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold max-w-md">
            Cinco peças que resolvem sua alimentação de verdade
          </h2>
          <p className="text-zinc-400 max-w-sm text-sm">
            Do cardápio da semana à lista de compras — cada parte foi pensada pro seu dia a dia, não pra um app
            genérico de contagem de calorias.
          </p>
        </div>

        <div id="recursos" className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.n}
              className={`rounded-xl border p-6 ${
                f.highlight
                  ? "md:col-span-2 border-teal-500/40 bg-teal-500/5"
                  : "border-zinc-800 bg-zinc-900/50"
              }`}
            >
              <p className="text-xs text-zinc-500 font-mono mb-3">{f.n} {f.tag}</p>
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-4 ${f.bg}`}>
                <f.icon className={`h-5 w-5 ${f.color}`} />
              </div>
              <h3 className="font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* INSTALAÇÃO */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 border-t border-zinc-900 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-green-500 mb-3">— ACESSO</p>
          <h2 className="text-3xl font-bold mb-4">Funciona no navegador. No computador ou no celular.</h2>
          <p className="text-zinc-400 mb-6">
            Não precisa instalar nada pra começar — abre direto no navegador, de qualquer lugar.
          </p>
          <ul className="space-y-3 text-sm text-zinc-300">
            <li className="flex gap-2"><span className="text-zinc-600">—</span> Funciona igual no computador e no celular.</li>
            <li className="flex gap-2"><span className="text-zinc-600">—</span> Mesmo login, mesmos dados, em qualquer aparelho.</li>
            <li className="flex gap-2"><span className="text-zinc-600">—</span> Sem instalação obrigatória, sem mexer com TI.</li>
          </ul>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex items-center justify-center">
          <Sparkles className="h-16 w-16 text-green-500/60" />
        </div>
      </section>

      {/* FAQ OBJEÇÃO */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 border-t border-zinc-900">
        <p className="text-xs font-bold uppercase tracking-widest text-green-500 mb-3">— ANTES DE DECIDIR</p>
        <h2 className="text-3xl font-bold mb-10 max-w-lg">Perguntas de quem já tentou dieta em planilha</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 border border-zinc-800 rounded-xl overflow-hidden">
          {OBJECTION_FAQ.map((item, i) => (
            <div key={item.q} className={`p-6 border-zinc-800 ${i % 2 === 0 ? "md:border-r" : ""} ${i < 2 ? "border-b" : ""}`}>
              <p className="text-xs text-zinc-600 mb-2">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="font-bold mb-2">{item.q}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" className="max-w-6xl mx-auto px-4 sm:px-6 py-20 border-t border-zinc-900">
        <p className="text-xs font-bold uppercase tracking-widest text-green-500 mb-3">— PLANOS</p>
        <h2 className="text-3xl font-bold mb-10 max-w-lg">Um plano pro tamanho da sua rotina</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 flex flex-col">
            <h3 className="font-bold mb-1">Starter</h3>
            <p className="text-2xl font-bold mb-4">Grátis</p>
            <p className="text-zinc-400 text-sm mb-6">Pra quem quer começar a organizar a própria alimentação sem compromisso.</p>
            <ul className="space-y-2 mb-8 flex-1 text-sm text-zinc-300">
              <li className="flex gap-2"><Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" /> 2 cardápios por mês</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" /> Chef IA 5x por semana</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" /> Até 5 planos alimentares salvos</li>
            </ul>
            <button onClick={() => navigate("/register")} className="border border-zinc-700 hover:border-zinc-500 text-white font-bold py-2.5 rounded-lg transition-colors">
              Começar grátis
            </button>
          </div>

          <div className="rounded-2xl border-2 border-green-500 bg-green-500/5 p-6 flex flex-col relative">
            <span className="absolute -top-3 left-6 text-[10px] font-bold uppercase tracking-wide bg-green-600 text-white px-2 py-1 rounded-full">
              Mais popular
            </span>
            <h3 className="font-bold mb-1">Plus</h3>
            <p className="text-2xl font-bold mb-4">R$ 29,90<span className="text-sm font-normal text-zinc-400">/mês</span></p>
            <p className="text-zinc-400 text-sm mb-6">Pra quem já usa toda semana e quer lista de compras liberada.</p>
            <ul className="space-y-2 mb-8 flex-1 text-sm text-zinc-300">
              <li className="flex gap-2"><Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" /> 1 cardápio semanal + diário todo dia</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" /> Chef IA 30x por mês</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" /> Lista de compras liberada</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" /> Até 30 planos alimentares salvos</li>
            </ul>
            <button onClick={() => navigate("/register")} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-lg transition-colors">
              Começar grátis
            </button>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 flex flex-col">
            <h3 className="font-bold mb-1">Pro</h3>
            <p className="text-2xl font-bold mb-4">R$ 59,90<span className="text-sm font-normal text-zinc-400">/mês</span></p>
            <p className="text-zinc-400 text-sm mb-6">Uso ilimitado de tudo, sem se preocupar com limite nenhum.</p>
            <ul className="space-y-2 mb-8 flex-1 text-sm text-zinc-300">
              <li className="flex gap-2"><Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" /> Cardápios ilimitados</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" /> Chef IA ilimitado</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" /> Planos alimentares ilimitados</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" /> Receitas próprias ilimitadas</li>
            </ul>
            <button onClick={() => navigate("/register")} className="border border-zinc-700 hover:border-zinc-500 text-white font-bold py-2.5 rounded-lg transition-colors">
              Começar grátis
            </button>
          </div>
        </div>
      </section>

      {/* FAQ ACORDEÃO */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-20 border-t border-zinc-900">
        <p className="text-xs font-bold uppercase tracking-widest text-green-500 mb-3">— FAQ</p>
        <h2 className="text-3xl font-bold mb-10">Perguntas frequentes</h2>
        <div className="divide-y divide-zinc-800 border-t border-b border-zinc-800">
          {FAQ_ITEMS.map((item, i) => (
            <div key={item.q}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between py-5 text-left"
              >
                <span className="font-medium">{item.q}</span>
                {openFaq === i ? (
                  <Minus className="h-4 w-4 text-zinc-500 shrink-0" />
                ) : (
                  <Plus className="h-4 w-4 text-zinc-500 shrink-0" />
                )}
              </button>
              {openFaq === i && <p className="text-zinc-400 text-sm pb-5 leading-relaxed">{item.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-gradient-to-r from-green-700 to-green-600 rounded-2xl p-10 sm:p-14 flex flex-col sm:flex-row items-center justify-between gap-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-green-200 mb-3">— Comece hoje</p>
            <h2 className="text-3xl font-bold text-white max-w-md">
              Chega de planilha de dieta. Planeje sua alimentação de verdade.
            </h2>
          </div>
          <div className="flex flex-col gap-3 items-center">
            <button
              onClick={() => navigate("/register")}
              className="bg-white text-green-700 font-bold px-6 py-3.5 rounded-xl hover:bg-green-50 transition-colors whitespace-nowrap"
            >
              Começar grátis
            </button>
            <a href="#planos" className="text-sm text-green-100 hover:text-white">Ver planos</a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-zinc-900 mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8">
          <div className="col-span-2 sm:col-span-1">
            <img src="/nutri-agent-logo-horizontal.png" alt="NutriAgent" className="h-6 w-auto object-contain mb-3" />
            <p className="text-zinc-500 text-sm">Nutrição inteligente com IA pro seu dia a dia.</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-zinc-500 mb-3">Produto</p>
            <ul className="space-y-2 text-sm text-zinc-400">
              <li><a href="#recursos" className="hover:text-white">Recursos</a></li>
              <li><a href="#planos" className="hover:text-white">Planos</a></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-zinc-500 mb-3">Conta</p>
            <ul className="space-y-2 text-sm text-zinc-400">
              <li><button onClick={() => navigate("/login")} className="hover:text-white">Entrar</button></li>
              <li><button onClick={() => navigate("/register")} className="hover:text-white">Criar conta</button></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-zinc-500 mb-3">NutriAgent</p>
            <p className="text-sm text-zinc-500">© {new Date().getFullYear()} NutriAgent</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
