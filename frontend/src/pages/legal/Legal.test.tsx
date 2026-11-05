import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Politica } from "./Politica";
import { Termos } from "./Termos";

describe("páginas legais", () => {
  it("Política renderiza o documento", () => {
    render(<MemoryRouter><Politica /></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 1, name: /Política de Privacidade/ })).toBeInTheDocument();
  });
  it("Termos renderiza o documento com 18+", () => {
    render(<MemoryRouter><Termos /></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 1, name: /Termos de Uso/ })).toBeInTheDocument();
    expect(screen.getByText(/maiores de 18 anos/)).toBeInTheDocument();
  });
});
