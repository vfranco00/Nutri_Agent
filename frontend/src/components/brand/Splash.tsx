import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../lib/AuthContext";
import { NuviSlice } from "./NuviSlice";

const EASE_OUT = "cubic-bezier(0.23,1,0.32,1)";
const EASE_IN_OUT = "cubic-bezier(0.77,0,0.175,1)";
const CREME = "#FFF6EC";
const LARANJA = "#E8590C";
const GOMO = "#FF9A52";

const ESPERA_ONDA_MS = 300;
const LIMITE_MS = 8000;

function reduzido(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function standalone(): boolean {
  if (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches) return true;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** O logo do topo que está visível (celular ou computador): para onde a fatia voa. */
function alvoVisivel(): HTMLElement | null {
  const todos = Array.from(document.querySelectorAll<HTMLElement>("[data-splash-target]"));
  return todos.find((e) => e.getBoundingClientRect().width > 0) ?? null;
}

function animar(el: Element, frames: Keyframe[], opts: KeyframeAnimationOptions): Animation | null {
  return typeof el.animate === "function" ? el.animate(frames, opts) : null;
}

export interface SplashProps {
  ready: boolean;
  error?: boolean;
  onDone: () => void;
}

/**
 * Abertura do PWA (docs/design/12-animacoes.html, `playSplash`): fundo laranja com a fatia.
 * A onda só começa se a espera passar de 300 ms. Com os dados prontos, os gomos voltam a 1,
 * a fatia voa até o logo do topo, o fundo some e o conteúdo entra em cascata. Passados 8 s
 * sem dados (ou com `error`), sai e chama `onDone` para a tela mostrar o erro.
 */
export function Splash({ ready, error = false, onDone }: SplashProps) {
  const raiz = useRef<HTMLDivElement>(null);
  const fatia = useRef<HTMLDivElement>(null);
  const marca = useRef<HTMLSpanElement>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });
  const [onda, setOnda] = useState(false);
  const [saindo, setSaindo] = useState(false);

  // a onda só liga se houver espera de verdade
  useEffect(() => {
    if (ready || error) return;
    const t = setTimeout(() => setOnda(true), ESPERA_ONDA_MS);
    return () => clearTimeout(t);
  }, [ready, error]);

  // sem dados por 8 s: desiste
  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => onDoneRef.current(), LIMITE_MS);
    return () => clearTimeout(t);
  }, [ready]);

  useEffect(() => {
    if (error) onDoneRef.current();
  }, [error]);

  // dados prontos: saída
  useEffect(() => {
    if (!ready) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const alvo = alvoVisivel();
    const el = raiz.current;
    const svg = fatia.current?.querySelector("svg");
    let vivo = true;
    const fim = () => {
      if (!vivo) return;
      if (alvo) alvo.style.opacity = "";
      setSaindo(true);
      onDoneRef.current();
    };

    if (!el || !svg) {
      fim();
      return;
    }
    if (alvo) alvo.style.opacity = "0";

    // movimento reduzido, sem WAAPI ou sem logo para onde voar: só opacidade, 200 ms
    const rect = alvo?.querySelector("svg")?.getBoundingClientRect() ?? null;
    if (reduzido() || typeof el.animate !== "function" || !rect || rect.width === 0) {
      const a = animar(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease", fill: "forwards" });
      if (a) a.finished.then(fim, fim);
      else timers.push(setTimeout(fim, 0));
      return () => {
        vivo = false;
        timers.forEach(clearTimeout);
        if (alvo) alvo.style.opacity = "";
      };
    }

    // 1) gomos voltam a 1 em 160 ms
    svg.querySelectorAll(".nuvi-gomo").forEach((g) => {
      const cs = getComputedStyle(g);
      animar(g, [{ opacity: cs.opacity, transform: cs.transform === "none" ? "none" : cs.transform }, { opacity: 1, transform: "none" }], { duration: 160, easing: EASE_OUT, fill: "forwards" });
    });

    // 2) a fatia voa até o logo do topo (420 ms), o fundo some (280 ms, atraso 140), o conteúdo entra
    timers.push(
      setTimeout(() => {
        const a = svg.getBoundingClientRect();
        const dx = rect.left + rect.width / 2 - (a.left + a.width / 2);
        const dy = rect.top + rect.height / 2 - (a.top + a.height / 2);
        const s = rect.width / a.width;
        const escuro = document.documentElement.classList.contains("dark");
        const miolo = escuro ? "#1A120B" : CREME;
        const opts: KeyframeAnimationOptions = { duration: 420, easing: EASE_IN_OUT, fill: "forwards" };

        if (marca.current) animar(marca.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: EASE_OUT, fill: "forwards" });
        const voo = animar(svg, [{ transform: "none" }, { transform: `translate(${dx}px,${dy}px) scale(${s})` }], opts);
        const [casca, corte] = Array.from(svg.querySelectorAll("circle"));
        animar(casca, [{ fill: CREME }, { fill: LARANJA }], opts);
        animar(corte, [{ fill: LARANJA }, { fill: miolo }], opts);
        svg.querySelectorAll(".nuvi-gomo").forEach((g) => animar(g, [{ fill: CREME }, { fill: GOMO }], opts));
        animar(el, [{ backgroundColor: LARANJA }, { backgroundColor: "rgba(232,89,12,0)" }], { duration: 280, delay: 140, easing: EASE_OUT, fill: "forwards" });

        // conteúdo em cascata: 260 ms, 40 ms de intervalo
        Array.from(document.querySelectorAll("main > div > *"))
          .slice(0, 8)
          .forEach((c, i) => animar(c, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 260, delay: 260 + i * 40, easing: EASE_OUT, fill: "backwards" }));

        if (voo) voo.finished.then(fim, fim);
        else fim();
      }, 160),
    );

    return () => {
      vivo = false;
      timers.forEach(clearTimeout);
      if (alvo) alvo.style.opacity = "";
    };
  }, [ready]);

  if (saindo) return null;

  return (
    <div
      ref={raiz}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3.5"
      style={{ backgroundColor: LARANJA }}
      role="status"
      aria-label="Abrindo o Nuvi"
    >
      <div ref={fatia}>
        <NuviSlice size={112} tone="onOrange" wave={onda} />
      </div>
      <span
        ref={marca}
        style={{ fontFamily: "var(--font-logo)", fontWeight: 900, letterSpacing: "-0.04em", fontSize: 48, lineHeight: 1, color: CREME }}
      >
        nuvi
      </span>
    </div>
  );
}

let jaAbriu = false;

/**
 * Liga a abertura só no PWA instalado (`display-mode: standalone`) e no primeiro
 * carregamento. Sem dados em 8 s, a abertura sai e a tela mostra o erro.
 */
export function SplashGate() {
  const { loading } = useAuth();
  const [fase, setFase] = useState<"splash" | "erro" | "fim">(() => (!jaAbriu && standalone() ? "splash" : "fim"));
  const carregando = useRef(loading);
  useEffect(() => {
    carregando.current = loading;
  });
  useEffect(() => {
    if (fase === "splash") jaAbriu = true;
  }, [fase]);

  if (fase === "splash") {
    return <Splash ready={!loading} onDone={() => setFase(carregando.current ? "erro" : "fim")} />;
  }
  if (fase === "erro" && loading) {
    return (
      <div role="alert" className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-bg px-8 text-center text-ink">
        <NuviSlice size={64} />
        <p className="text-lg font-extrabold">Não deu para abrir o Nuvi</p>
        <p className="text-sm text-mut">Confira a conexão e tente de novo.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-2xl bg-act px-5 py-3 text-sm font-extrabold text-on-act active:scale-[.97]"
        >
          Tentar de novo
        </button>
      </div>
    );
  }
  return null;
}
