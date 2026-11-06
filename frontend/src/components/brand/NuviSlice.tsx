import type { CSSProperties } from "react";
import { GOMOS } from "./gomos";

export type NuviTone = "light" | "dark" | "onOrange";

export interface NuviSliceProps {
  size?: number;
  tone?: NuviTone;
  wave?: boolean | "once";
  face?: false | "normal" | "happy";
  title?: string;
  className?: string;
}

// casca / parte branca (miolo) / gomos, por fundo onde a fatia está
const TONES: Record<NuviTone, { rind: string; cut: string; gomo: string }> = {
  light: { rind: "#E8590C", cut: "#FFF6EC", gomo: "#FF9A52" },
  dark: { rind: "#E8590C", cut: "#1A120B", gomo: "#FF9A52" },
  onOrange: { rind: "#FFF6EC", cut: "#E8590C", gomo: "#FFF6EC" },
};

export function NuviSlice({ size = 28, tone = "light", wave = false, face = false, title, className }: NuviSliceProps) {
  const c = TONES[tone];
  const cls = [
    "nuvi-slice",
    wave === true ? "nuvi-wave" : wave === "once" ? "nuvi-wave-once" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cls}
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}
    >
      {title ? <title>{title}</title> : null}
      {/* --nuvi-cut deixa o miolo acompanhar o cartão onde a fatia está */}
      <circle cx="50" cy="50" r="41" fill={c.rind} />
      <circle cx="50" cy="50" r="35" fill={`var(--nuvi-cut, ${c.cut})`} />
      <g>
        {GOMOS.map((d, i) => (
          <path key={i} className="nuvi-gomo" style={{ "--i": i } as CSSProperties} d={d} fill={c.gomo} />
        ))}
      </g>
      {face ? (
        <g className="nuvi-face">
          {face === "happy" ? (
            <>
              <path data-olho="arco" d="M37.5 49 Q42 43.5 46.5 49" fill="none" stroke="#1C1712" strokeWidth="3" strokeLinecap="round" />
              <path data-olho="arco" d="M53.5 49 Q58 43.5 62.5 49" fill="none" stroke="#1C1712" strokeWidth="3" strokeLinecap="round" />
            </>
          ) : (
            <>
              <circle data-olho="aberto" cx="42" cy="48" r="5.5" fill="#fff" />
              <circle data-olho="aberto" cx="58" cy="48" r="5.5" fill="#fff" />
              <circle data-olho="aberto" cx="43.1" cy="48.8" r="2.9" fill="#1C1712" />
              <circle data-olho="aberto" cx="59.1" cy="48.8" r="2.9" fill="#1C1712" />
            </>
          )}
          <path d="M43 60 Q50 66 57 60" fill="none" stroke="#1C1712" strokeWidth="3.6" strokeLinecap="round" />
        </g>
      ) : null}
    </svg>
  );
}
