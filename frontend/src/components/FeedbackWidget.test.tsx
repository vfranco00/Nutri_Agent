import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FeedbackWidget } from "./FeedbackWidget";

vi.mock("../lib/api", () => ({ api: { post: vi.fn() } }));
vi.mock("../lib/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("../lib/AlertContext", () => ({ useAlert: () => ({ showAlert: vi.fn() }) }));
vi.mock("../lib/FeedbackContext", () => ({
  useFeedback: () => ({ isOpen: false, openFeedbackModal: vi.fn(), closeFeedbackModal: vi.fn() }),
}));

function renderEm(rota: string) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <FeedbackWidget />
    </MemoryRouter>,
  );
}

describe("FeedbackWidget", () => {
  it("na landing a bolinha fica pequena, acima da barra inferior e na cor Nuvi", () => {
    renderEm("/");
    const b = screen.getByRole("button", { name: /ajuda e feedback/i });
    expect(b.className).toContain("h-10");
    expect(b.className).toContain("68px");
    expect(b.className).toContain("bg-act");
    expect(b.className).not.toMatch(/green|bottom-28/);
  });

  it.each(["/register", "/termos", "/forgot-password"])("aparece na tela pública %s", (rota) => {
    renderEm(rota);
    expect(screen.getByRole("button", { name: /ajuda e feedback/i })).toBeInTheDocument();
  });

  it.each(["/hoje", "/diario", "/cardapios", "/receitas", "/perfil", "/perfil/lembretes", "/progresso"])(
    "não aparece na rota logada %s",
    (rota) => {
      renderEm(rota);
      expect(screen.queryByRole("button", { name: /ajuda e feedback/i })).not.toBeInTheDocument();
    },
  );
});
