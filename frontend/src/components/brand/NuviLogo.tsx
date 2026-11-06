import type { CSSProperties } from "react";
import { GOMOS, GOMOS_SIMPLES } from "./gomos";
import type { NuviTone } from "./NuviSlice";

export type NuviLogoTone = NuviTone | "auto";

export interface NuviLogoProps {
  /** Tamanho da letra em px (a fatia do pingo mede 0,42 desse valor). */
  size?: number;
  /** "auto" acompanha a classe `dark` da página; os demais fixam o fundo. */
  tone?: NuviLogoTone;
  /** A onda roda nos gomos do pingo. */
  wave?: boolean | "once";
}

// casca / parte branca / gomo / texto, por fundo (logotipo aprovado em 06/11/2026)
const TONES: Record<NuviTone, { rind: string; cut: string; gomo: string }> = {
  light: { rind: "#E8590C", cut: "#FFF6EC", gomo: "#FF9A52" },
  dark: { rind: "#FF6A26", cut: "#1A120B", gomo: "#FFB07A" },
  onOrange: { rind: "#FFF6EC", cut: "#E8590C", gomo: "#FFF6EC" },
};

/** Abaixo de ~40 px de letra a fatia usa os gomos simplificados. */
const LIMITE_SIMPLES = 40;

/**
 * Logotipo "nuvi": "nuv" + "ı" (i sem pingo) em Nunito 900, com a fatia de laranja no lugar do
 * pingo (docs/design/17-logo-pingo.html, versão B). Única exceção à regra de uma fonte só.
 */
export function NuviLogo({ size = 28, tone = "light", wave = false }: NuviLogoProps) {
  const c = TONES[tone === "auto" ? "light" : tone];
  const gomos = size < LIMITE_SIMPLES ? GOMOS_SIMPLES : GOMOS;
  const cls = ["nuvi-pingo", tone === "auto" ? "nuvi-pingo-auto" : "", wave === true ? "nuvi-wave" : wave === "once" ? "nuvi-wave-once" : ""]
    .filter(Boolean)
    .join(" ");
  const vars = tone === "auto"
    ? undefined
    : ({ "--pg-rind": c.rind, "--pg-cut": c.cut, "--pg-gomo": c.gomo } as CSSProperties);
  return (
    <span
      className="nuvi-logo nuvi-wordmark"
      role="img"
      aria-label="nuvi"
      style={{
        position: "relative",
        display: "inline-block",
        fontFamily: "var(--font-logo)",
        fontWeight: 900,
        letterSpacing: "-0.04em",
        fontSize: size,
        lineHeight: 1,
        color: tone === "onOrange" ? "#FFF6EC" : "var(--ink)",
      }}
    >
      <span aria-hidden="true">nuv</span>
      <span aria-hidden="true" style={{ position: "relative", display: "inline-block", letterSpacing: 0, lineHeight: 1 }}>
        ı
        <svg
          viewBox="0 0 100 100"
          className={cls}
          style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: "0.8em", width: "0.42em", height: "0.42em", ...vars }}
        >
          <circle cx="50" cy="50" r="41" fill="var(--pg-rind)" />
          <circle cx="50" cy="50" r="35" fill="var(--pg-cut)" />
          <g>
            {gomos.map((d, i) => (
              <path key={i} className="nuvi-gomo" style={{ "--i": i } as CSSProperties} d={d} fill="var(--pg-gomo)" />
            ))}
          </g>
        </svg>
      </span>
    </span>
  );
}
