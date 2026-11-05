// Os tokens Nuvi moram em src/index.css. Este teste lê o arquivo e garante
// duas coisas da spec: os nomes que as frentes vão usar existem, e todo par de
// texto passa no contraste AA (4,5:1) nos temas claro e escuro.
/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

function block(selector: string): Record<string, string> {
  const re = new RegExp(`(^|\\n)${selector.replace(/[.:]/g, "\\$&")}\\s*\\{([^}]*)\\}`);
  const m = css.match(re);
  if (!m) throw new Error(`bloco ${selector} não encontrado`);
  const out: Record<string, string> = {};
  for (const [, k, v] of m[2].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out[k] = v.trim();
  return out;
}

function lum(hex: string): number {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const BRAND = {
  "nuvi-laranja": "#E8590C",
  "nuvi-laranja-texto": "#C2410C",
  "nuvi-gomo": "#FF9A52",
  "nuvi-verde": "#3FA34D",
  "nuvi-verde-texto": "#2F7A33",
  "nuvi-creme": "#FFF6EC",
  "nuvi-tinta": "#1C1712",
  "nuvi-secundario": "#7A6A58",
  "nuvi-escuro": "#1A120B",
  "nuvi-cartao-escuro": "#261B13",
  "nuvi-texto-escuro": "#F3EFE9",
};

describe("tokens Nuvi", () => {
  it("declara as cores da marca no @theme", () => {
    for (const [k, v] of Object.entries(BRAND)) {
      expect(css).toMatch(new RegExp(`--color-${k}:\\s*${v};`, "i"));
    }
  });

  it("expõe os aliases semânticos como utilitários", () => {
    for (const k of ["bg", "card", "ink", "mut", "line", "soft", "act", "on-act", "act-text", "pos", "pos-text"]) {
      expect(css).toMatch(new RegExp(`--color-${k}:\\s*var\\(--${k}\\);`));
    }
  });

  it("usa DM Sans e as três curvas da spec", () => {
    expect(css).toMatch(/--font-sans:\s*"DM Sans"/);
    expect(css).toMatch(/--ease-out:\s*cubic-bezier\(0\.23,\s*1,\s*0\.32,\s*1\)/);
    expect(css).toMatch(/--ease-in-out:\s*cubic-bezier\(0\.77,\s*0,\s*0\.175,\s*1\)/);
    expect(css).toMatch(/--ease-drawer:\s*cubic-bezier\(0\.32,\s*0\.72,\s*0,\s*1\)/);
  });

  it("botão laranja usa texto tinta, nunca branco", () => {
    const light = block(":root");
    expect(light["on-act"].toUpperCase()).toBe("#1C1712");
    expect(light.act.toUpperCase()).toBe("#E8590C");
  });

  for (const theme of [":root", ".dark"]) {
    it(`texto passa AA em ${theme}`, () => {
      const t = { ...block(":root"), ...(theme === ".dark" ? block(".dark") : {}) };
      for (const surface of ["bg", "card"]) {
        for (const text of ["ink", "mut", "act-text", "pos-text"]) {
          expect(contrast(t[text], t[surface]), `${text} sobre ${surface}`).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(contrast(t["on-act"], t.act), "on-act sobre act").toBeGreaterThanOrEqual(4.5);
    });
  }
});
