import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { NaoEncontrada } from "./NaoEncontrada";

describe("NaoEncontrada", () => {
  it("rota desconhecida mostra a página e o link para o início", () => {
    render(
      <MemoryRouter initialEntries={["/rota-que-nao-existe"]}>
        <Routes>
          <Route path="/" element={<p>início</p>} />
          <Route path="*" element={<NaoEncontrada />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Página não encontrada" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao início" })).toHaveAttribute("href", "/");
  });
});
