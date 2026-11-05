import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), request: vi.fn(), interceptors: { response: { use: vi.fn() } } },
}));

import { api } from "../../lib/api";
import { ConsentGate } from "./ConsentGate";
import { requestConsent, ensureConsent } from "../../lib/consents";

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
});

describe("ConsentGate", () => {
  it("abre a folha de IA explicando que vai para o Gemini nos EUA e grava ao permitir", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { policy_version: "v", items: [] } });
    const user = userEvent.setup();
    render(<ConsentGate />);

    let resultado: Promise<boolean>;
    act(() => { resultado = requestConsent("ia"); });

    expect(await screen.findByText(/Google Gemini/)).toBeInTheDocument();
    expect(screen.getByText(/Estados Unidos|EUA/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Permitir" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/consents/me", { purpose: "ia", granted: true, source: "primeiro_uso" }));
    expect(await resultado!).toBe(true);
  });

  it("'Agora não' não grava nada e resolve false", async () => {
    const user = userEvent.setup();
    render(<ConsentGate />);
    let resultado: Promise<boolean>;
    act(() => { resultado = requestConsent("push"); });

    await user.click(await screen.findByRole("button", { name: "Agora não" }));
    expect(api.post).not.toHaveBeenCalled();
    expect(await resultado!).toBe(false);
  });

  it("ensureConsent não abre a folha quando a finalidade já está concedida", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { policy_version: "v", items: [{ purpose: "push", granted: true, at: "x" }] } });
    render(<ConsentGate />);
    expect(await ensureConsent("push")).toBe(true);
    expect(screen.queryByRole("button", { name: "Permitir" })).not.toBeInTheDocument();
  });
});
