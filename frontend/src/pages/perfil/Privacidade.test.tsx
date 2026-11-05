import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn(), request: vi.fn(), interceptors: { response: { use: vi.fn() } } },
}));
const logout = vi.fn();
vi.mock("../../lib/AuthContext", () => ({ useAuth: () => ({ logout }) }));

import { api } from "../../lib/api";
import { Privacidade } from "./Privacidade";

const estado = {
  policy_version: "2026-11-v1",
  items: [
    { purpose: "saude", granted: true, at: "2026-11-05T10:00:00Z" },
    { purpose: "ia", granted: true, at: "2026-11-05T10:00:00Z" },
    { purpose: "push", granted: false, at: null },
    { purpose: "ranking", granted: false, at: null },
    { purpose: "marketing", granted: false, at: null },
  ],
};

beforeEach(() => {
  vi.mocked(api.get).mockReset().mockResolvedValue({ data: estado });
  vi.mocked(api.post).mockReset();
  vi.mocked(api.delete).mockReset();
  logout.mockReset();
});

function montar() {
  return render(<MemoryRouter><Privacidade /></MemoryRouter>);
}

describe("Privacidade", () => {
  it("mostra um switch por finalidade com o estado vindo da API", async () => {
    montar();
    const ia = await screen.findByRole("switch", { name: /Enviar dados à IA/ });
    expect(ia).toBeChecked();
    expect(screen.getByRole("switch", { name: /Lembretes/ })).not.toBeChecked();
  });

  it("ligar um switch chama POST /consents/me", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ...estado, items: estado.items.map((i) => (i.purpose === "push" ? { ...i, granted: true } : i)) } });
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole("switch", { name: /Lembretes/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/consents/me", { purpose: "push", granted: true, source: "perfil" }));
    await waitFor(() => expect(screen.getByRole("switch", { name: /Lembretes/ })).toBeChecked());
  });

  it("desligar usa o mesmo caminho, sem confirmação extra", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: estado });
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole("switch", { name: /Enviar dados à IA/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/consents/me", { purpose: "ia", granted: false, source: "perfil" }));
  });

  it("saúde não tem switch: revogar é excluir a conta", async () => {
    montar();
    await screen.findByRole("switch", { name: /Enviar dados à IA/ });
    expect(screen.queryByRole("switch", { name: /saúde/i })).not.toBeInTheDocument();
    expect(screen.getByText(/excluir a conta/i)).toBeInTheDocument();
  });

  it("a exclusão pede a senha e só então chama DELETE /privacy/account", async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole("button", { name: "Excluir minha conta" }));

    const confirmar = await screen.findByRole("button", { name: "Excluir definitivamente" });
    expect(confirmar).toBeDisabled();
    expect(api.delete).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Sua senha"), "minhasenha123");
    await user.click(confirmar);

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/privacy/account", { data: { password: "minhasenha123" } }));
    await waitFor(() => expect(logout).toHaveBeenCalled());
  });

  it("senha errada mostra o erro e não desloga", async () => {
    vi.mocked(api.delete).mockRejectedValue({ response: { status: 403, data: { detail: "Senha incorreta" } } });
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole("button", { name: "Excluir minha conta" }));
    await user.type(await screen.findByLabelText("Sua senha"), "errada");
    await user.click(screen.getByRole("button", { name: "Excluir definitivamente" }));
    expect(await screen.findByText("Senha incorreta")).toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
  });

  it("'Baixar meus dados' chama GET /privacy/export", async () => {
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    vi.mocked(api.get).mockImplementation(async (url: string) =>
      url === "/privacy/export" ? { data: new Blob(["{}"]) } : { data: estado },
    );
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole("button", { name: "Baixar meus dados" }));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/privacy/export", { responseType: "blob" }));
  });
});
