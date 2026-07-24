import { describe, it, expect } from "vitest";
import { getNavItems, sectionTitleForPath } from "./navItems";

describe("getNavItems", () => {
  it("does not include Admin for regular users", () => {
    const items = getNavItems(false);
    expect(items.some((i) => i.path === "/admin")).toBe(false);
  });

  it("includes Admin for superusers", () => {
    const items = getNavItems(true);
    expect(items.some((i) => i.path === "/admin")).toBe(true);
  });

  it("always includes the core sections", () => {
    const paths = getNavItems(false).map((i) => i.path);
    expect(paths).toEqual(
      expect.arrayContaining(["/dashboard", "/profile", "/recipes", "/ai-plan", "/ai-chef", "/shopping", "/meal-plans", "/planos"]),
    );
  });
});

describe("sectionTitleForPath", () => {
  it("maps exact routes to their section name", () => {
    expect(sectionTitleForPath("/dashboard")).toBe("Início");
    expect(sectionTitleForPath("/ai-chef")).toBe("Chef IA");
    expect(sectionTitleForPath("/profile")).toBe("Meu Perfil");
  });

  it("maps subroutes to the parent section (most specific prefix)", () => {
    expect(sectionTitleForPath("/recipes/new")).toBe("Minhas Receitas");
    expect(sectionTitleForPath("/meal-plans/123")).toBe("Planos Alimentares");
  });

  it("labels every admin route as the admin panel", () => {
    expect(sectionTitleForPath("/admin")).toBe("Painel Admin");
    expect(sectionTitleForPath("/admin/users")).toBe("Painel Admin");
    expect(sectionTitleForPath("/admin/finance")).toBe("Painel Admin");
  });

  it("falls back to the brand name for unknown routes", () => {
    expect(sectionTitleForPath("/rota-inexistente")).toBe("NutriAgent");
  });
});
