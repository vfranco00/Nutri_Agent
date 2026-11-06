import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { NuviLogo } from "./NuviLogo";

describe("NuviLogo", () => {
  it("lê 'nuvi' e desenha 'nuv' + 'ı' com a fatia no pingo, sem símbolo ao lado", () => {
    const { container, getByRole } = render(<NuviLogo />);
    expect(getByRole("img").getAttribute("aria-label")).toBe("nuvi");
    expect(container.textContent).toBe("nuvı");
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(container.querySelectorAll(".nuvi-gomo")).toHaveLength(8);
  });

  it("a fatia mede 0,42em e fica 0,8em acima da base do ı", () => {
    const { container } = render(<NuviLogo />);
    const s = container.querySelector("svg")!;
    expect(s.style.width).toBe("0.42em");
    expect(s.style.height).toBe("0.42em");
    expect(s.style.bottom).toBe("0.8em");
  });

  it("wave liga a onda nos gomos do pingo; wave='once' roda uma volta", () => {
    const a = render(<NuviLogo wave />);
    expect(a.container.querySelector("svg")!.classList.contains("nuvi-wave")).toBe(true);
    const b = render(<NuviLogo wave="once" />);
    expect(b.container.querySelector("svg")!.classList.contains("nuvi-wave-once")).toBe(true);
    const c = render(<NuviLogo />);
    expect(c.container.querySelector("svg")!.getAttribute("class")).not.toContain("nuvi-wave");
  });

  it("cores por fundo", () => {
    const get = (tone: "light" | "dark" | "onOrange") => render(<NuviLogo tone={tone} />).container.querySelector("svg")!.style;
    expect(get("light").getPropertyValue("--pg-rind")).toBe("#E8590C");
    expect(get("dark").getPropertyValue("--pg-rind")).toBe("#FF6A26");
    expect(get("dark").getPropertyValue("--pg-gomo")).toBe("#FFB07A");
    expect(get("onOrange").getPropertyValue("--pg-cut")).toBe("#E8590C");
  });

  it("tone='auto' deixa as cores para o CSS (classe dark)", () => {
    const { container } = render(<NuviLogo tone="auto" />);
    const s = container.querySelector("svg")!;
    expect(s.classList.contains("nuvi-pingo-auto")).toBe(true);
    expect(s.style.getPropertyValue("--pg-rind")).toBe("");
  });

  it("abaixo de 40 px usa os gomos simplificados", () => {
    const grande = render(<NuviLogo size={72} />).container.querySelector(".nuvi-gomo")!.getAttribute("d");
    const pequeno = render(<NuviLogo size={28} />).container.querySelector(".nuvi-gomo")!.getAttribute("d");
    expect(grande).not.toBe(pequeno);
  });
});
