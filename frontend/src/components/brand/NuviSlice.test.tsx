import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { NuviSlice } from "./NuviSlice";
import { NuviLoader } from "./NuviLoader";

describe("NuviSlice", () => {
  it("renderiza 8 gomos", () => {
    const { container } = render(<NuviSlice />);
    expect(container.querySelectorAll(".nuvi-gomo")).toHaveLength(8);
  });

  it("wave aplica a classe nuvi-wave e wave='once' a variante de uma volta", () => {
    const { container, rerender } = render(<NuviSlice wave />);
    expect(container.querySelector("svg")!.classList.contains("nuvi-wave")).toBe(true);
    rerender(<NuviSlice wave="once" />);
    expect(container.querySelector("svg")!.classList.contains("nuvi-wave-once")).toBe(true);
  });

  it("face='happy' desenha os olhos fechados em arco", () => {
    const { container } = render(<NuviSlice face="happy" />);
    expect(container.querySelectorAll("path[data-olho='arco']")).toHaveLength(2);
    expect(container.querySelectorAll("circle[data-olho='aberto']")).toHaveLength(0);
  });

  it("face='normal' desenha olhos abertos", () => {
    const { container } = render(<NuviSlice face="normal" />);
    expect(container.querySelectorAll("circle[data-olho='aberto']").length).toBeGreaterThan(0);
  });

  it("com title o SVG tem role=img; sem title fica aria-hidden", () => {
    const a = render(<NuviSlice title="Nuvi" />);
    expect(a.container.querySelector("svg")!.getAttribute("role")).toBe("img");
    const b = render(<NuviSlice />);
    expect(b.container.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("NuviLoader", () => {
  it("não mostra nada antes de 300 ms", () => {
    const { container } = render(<NuviLoader active label="Carregando" />);
    expect(container.firstChild).toBeNull();
  });
});
