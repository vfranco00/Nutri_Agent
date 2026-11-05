import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { LEGACY_REDIRECTS, ROUTES, openRegistrar, refeicaoPorHorario } from "./routes";
import { LegacyRedirect } from "./components/shell/LegacyRedirect";

function Destino() {
  const l = useLocation();
  return <div data-testid="destino">{l.pathname + l.search}</div>;
}

function renderEm(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        {LEGACY_REDIRECTS.map(([from, to]) => (
          <Route key={from} path={from} element={<LegacyRedirect to={to} />} />
        ))}
        <Route path="*" element={<Destino />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LEGACY_REDIRECTS", () => {
  const casos: Array<[string, string]> = [
    ["/dashboard", "/hoje"],
    ["/profile", "/perfil"],
    ["/recipes", "/receitas"],
    ["/recipes/new", "/receitas/nova"],
    ["/ai-plan", "/cardapios/gerar"],
    ["/ai-chef", "/chef"],
    ["/shopping", "/compras"],
    ["/meal-plans", "/cardapios"],
    ["/meal-plans/new", "/cardapios/novo"],
    ["/meal-plans/12", "/cardapios/12"],
    ["/planos", "/assinatura"],
  ];
  it.each(casos)("%s chega em %s", (de, para) => {
    renderEm(de);
    expect(screen.getByTestId("destino").textContent).toBe(para);
  });

  it("preserva o id e a query string", () => {
    renderEm("/meal-plans/12?x=1");
    expect(screen.getByTestId("destino").textContent).toBe("/cardapios/12?x=1");
  });

  it("preserva a query em rota sem parâmetro", () => {
    renderEm("/dashboard?x=1");
    expect(screen.getByTestId("destino").textContent).toBe("/hoje?x=1");
  });
});

describe("ROUTES", () => {
  it("monta rotas com parâmetro", () => {
    expect(ROUTES.cardapio(7)).toBe("/cardapios/7");
    expect(ROUTES.receita("3")).toBe("/receitas/3");
    expect(ROUTES.alimento("mine:4")).toBe("/registrar/alimento/mine%3A4");
  });
});

describe("refeicaoPorHorario", () => {
  it.each([
    [9, "cafe"],
    [10, "almoco"],
    [12, "almoco"],
    [15, "lanche"],
    [17, "lanche"],
    [18, "jantar"],
    [23, "jantar"],
  ] as const)("às %ih usa %s", (h, esperada) => {
    expect(refeicaoPorHorario(new Date(2026, 10, 5, h, 0))).toBe(esperada);
  });
});

describe("openRegistrar", () => {
  const loc = { pathname: "/hoje", search: "", hash: "", state: null, key: "k" };

  it("sem refeição às 12h usa almoco e guarda a tela de fundo", () => {
    const navigate = vi.fn();
    openRegistrar(navigate, loc, { now: new Date(2026, 10, 5, 12, 0) });
    expect(navigate).toHaveBeenCalledWith("/registrar?refeicao=almoco", { state: { background: loc } });
  });

  it("respeita refeição e data informadas", () => {
    const navigate = vi.fn();
    openRegistrar(navigate, loc, { refeicao: "jantar", data: "2026-11-04" });
    expect(navigate).toHaveBeenCalledWith("/registrar?refeicao=jantar&data=2026-11-04", { state: { background: loc } });
  });
});
