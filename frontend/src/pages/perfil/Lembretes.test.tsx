import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Lembretes } from "./Lembretes";
import { api } from "../../lib/api";

vi.mock("../../lib/api", () => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));

describe("Lembretes", () => {
  it("sem suporte a push mostra o aviso e deixa os switches desligados", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { timezone: "America/Sao_Paulo", reminders: [{ kind: "agua", time: "10:00", enabled: false }] },
    });
    render(
      <MemoryRouter>
        <Lembretes />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/não suporta notificações/i)).toBeInTheDocument();
    expect(await screen.findByRole("switch", { name: /Beber água/ })).toHaveAttribute("aria-disabled", "true");
  });
});
