import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { OnboardingGate, TourModal } from "./OnboardingGate";
import { ROUTES } from "../routes";

let usuario: Record<string, unknown> | null = null;
vi.mock("../lib/AuthContext", () => ({
  useAuth: () => ({ user: usuario, refreshUser: vi.fn() }),
}));
vi.mock("../lib/api", () => ({ api: { put: vi.fn() } }));

function Local() {
  const l = useLocation();
  return <div data-testid="local">{l.pathname + l.search}</div>;
}

describe("TourModal", () => {
  it("usa o botão primário Nuvi, sem verde nem zinc", () => {
    const { container } = render(<TourModal onFinish={() => {}} />);
    const proximo = screen.getByRole("button", { name: /próximo/i });
    expect(proximo.className).toContain("bg-act");
    expect(proximo.className).toContain("text-nuvi-tinta");
    expect(container.innerHTML).not.toMatch(/green-|zinc-|orange-|purple-|blue-|pink-|teal-/);
  });

  it("avança até o fim e termina", async () => {
    const fim = vi.fn();
    render(<TourModal onFinish={fim} />);
    const u = userEvent.setup();
    for (let i = 0; i < 4; i++) await u.click(screen.getByRole("button", { name: /próximo/i }));
    await u.click(screen.getByRole("button", { name: /começar a usar/i }));
    expect(fim).toHaveBeenCalledTimes(1);
  });
});

describe("OnboardingGate", () => {
  it("usuário sem perfil vai para /perfil?onboarding=1 (sem laço)", () => {
    usuario = { has_profile: false, has_seen_onboarding: false };
    render(
      <MemoryRouter initialEntries={["/hoje"]}>
        <OnboardingGate>
          <Routes>
            <Route path="*" element={<Local />} />
          </Routes>
        </OnboardingGate>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("local").textContent).toBe(`${ROUTES.perfil}?onboarding=1`);
  });
});
