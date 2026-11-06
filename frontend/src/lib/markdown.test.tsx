import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Markdown } from "./markdown";

describe("Markdown", () => {
  it("renderiza títulos, listas, negrito e parágrafos", () => {
    render(<Markdown source={"# Título\n\n## Sub\n\ntexto **forte** aqui\n\n- um\n- dois"} />);
    expect(screen.getByRole("heading", { level: 1, name: "Título" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Sub" })).toBeInTheDocument();
    expect(screen.getByText("forte").tagName).toBe("STRONG");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("nunca injeta HTML: tags viram texto", () => {
    const { container } = render(<Markdown source={"<img src=x onerror=alert(1)> **ok**"} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img");
  });

  it("só aceita links http(s), mailto e internos", () => {
    const { container } = render(<Markdown source={"[a](javascript:alert(1)) [b](https://x.com) [c](/termos)"} />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["https://x.com", "/termos"]);
  });

  it("renderiza tabelas, código inline e listas numeradas", () => {
    const src = "| A | B |\n|---|---|\n| **x** | `y` |\n\n1. um\n2. dois";
    render(<Markdown source={src} />);
    expect(screen.getAllByRole("columnheader").map((c) => c.textContent)).toEqual(["A", "B"]);
    expect(screen.getByRole("cell", { name: "y" }).querySelector("code")).not.toBeNull();
    expect(screen.getByText("x").tagName).toBe("STRONG");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(document.querySelector("ol")).not.toBeNull();
  });

  it("aceita código dentro de negrito", () => {
    const { container } = render(<Markdown source={"**`saude`** obrigatória"} />);
    expect(container.querySelector("strong code")?.textContent).toBe("saude");
    expect(container.textContent).not.toContain("`");
  });
});
