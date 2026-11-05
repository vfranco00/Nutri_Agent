import { describe, it, expect } from "vitest";
import { getNavGroups, getNavItems, sectionTitleForPath } from "./navItems";

describe("getNavGroups", () => {
  it("tem os 4 grupos na ordem da spec", () => {
    expect(getNavGroups(false).map((g) => g.title)).toEqual(["Acompanhar", "Planejar", "Cozinhar", "Conta"]);
  });

  it("o Agente abre o grupo Acompanhar", () => {
    const g = getNavGroups(false)[0];
    expect(g.items[0].path).toBe("/agente");
    expect(g.items.map((i) => i.path)).toEqual(["/agente", "/hoje", "/diario", "/progresso"]);
  });

  it("agrupa o resto como na spec", () => {
    const [, planejar, cozinhar, conta] = getNavGroups(false);
    expect(planejar.items.map((i) => i.path)).toEqual(["/cardapios", "/cardapios/gerar", "/compras"]);
    expect(cozinhar.items.map((i) => i.path)).toEqual(["/receitas", "/alimentos", "/chef", "/comunidade"]);
    expect(conta.items.map((i) => i.path)).toEqual(["/perfil", "/perfil/lembretes", "/assinatura"]);
  });
});

describe("getNavItems", () => {
  it("não inclui Admin para usuário comum", () => {
    expect(getNavItems(false).some((i) => i.path === "/admin")).toBe(false);
  });

  it("inclui Admin para superusuário", () => {
    expect(getNavItems(true).some((i) => i.path === "/admin")).toBe(true);
  });

  it("sempre inclui as seções principais", () => {
    const paths = getNavItems(false).map((i) => i.path);
    expect(paths).toEqual(
      expect.arrayContaining(["/hoje", "/perfil", "/receitas", "/cardapios/gerar", "/chef", "/compras", "/cardapios", "/assinatura"]),
    );
  });
});

describe("sectionTitleForPath", () => {
  it("casa rotas exatas", () => {
    expect(sectionTitleForPath("/hoje")).toBe("Hoje");
    expect(sectionTitleForPath("/chef")).toBe("Chef");
    expect(sectionTitleForPath("/perfil")).toBe("Perfil e metas");
  });

  it("usa o prefixo mais específico", () => {
    expect(sectionTitleForPath("/receitas/nova")).toBe("Minhas receitas");
    expect(sectionTitleForPath("/cardapios/123")).toBe("Cardápios");
    expect(sectionTitleForPath("/cardapios/gerar")).toBe("Gerar cardápio");
    expect(sectionTitleForPath("/perfil/lembretes")).toBe("Lembretes");
  });

  it("rotula todas as rotas admin como painel", () => {
    expect(sectionTitleForPath("/admin")).toBe("Painel Admin");
    expect(sectionTitleForPath("/admin/users")).toBe("Painel Admin");
  });

  it("volta ao nome da marca em rota desconhecida", () => {
    expect(sectionTitleForPath("/rota-inexistente")).toBe("Nuvi");
  });
});
