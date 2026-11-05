import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { BottomTabBar } from "./BottomTabBar";

function Sonda() {
  const l = useLocation();
  return <div data-testid="rota">{l.pathname + l.search}</div>;
}

function montar() {
  return render(
    <MemoryRouter initialEntries={["/hoje"]}>
      <BottomTabBar />
      <Routes>
        <Route path="*" element={<Sonda />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("BottomTabBar", () => {
  it("tem 5 itens e o do meio se chama Registrar", () => {
    montar();
    const itens = screen.getAllByRole("link").concat(screen.getAllByRole("button"));
    expect(itens).toHaveLength(5);
    const nav = screen.getByRole("navigation");
    const todos = Array.from(nav.querySelectorAll("a, button"));
    expect(todos[2].getAttribute("aria-label")).toBe("Registrar");
    expect(todos.map((e) => e.textContent?.trim()).filter(Boolean)).toEqual(["Hoje", "Diário", "Cardápio", "Agente"]);
  });

  it("o + abre /registrar com a refeição pelo horário", async () => {
    montar();
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));
    expect(screen.getByTestId("rota").textContent).toMatch(/^\/registrar\?refeicao=(cafe|almoco|lanche|jantar)$/);
  });
});
