import { NuviSlice, type NuviTone } from "./NuviSlice";

export interface NuviLogoProps {
  size?: number;
  tone?: NuviTone;
  wave?: boolean | "once";
}

/** Símbolo + "nuvi" em Nunito 900 (única exceção à regra de uma fonte só). */
export function NuviLogo({ size = 28, tone = "light", wave = false }: NuviLogoProps) {
  const color = tone === "onOrange" ? "#FFF6EC" : "var(--ink)";
  return (
    <span className="nuvi-logo" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <NuviSlice size={size} tone={tone} wave={wave} />
      <span
        className="nuvi-wordmark"
        style={{ fontFamily: "var(--font-logo)", fontWeight: 900, letterSpacing: "-0.04em", fontSize: size * 0.9, lineHeight: 1, color }}
      >
        nuvi
      </span>
    </span>
  );
}
