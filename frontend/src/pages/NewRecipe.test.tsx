import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { NewRecipe } from "./NewRecipe";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({ api: { post: vi.fn(), get: vi.fn() } }));
vi.mock("../lib/AlertContext", () => ({ useAlert: () => ({ showAlert: vi.fn() }) }));

beforeEach(() => vi.mocked(api.post).mockReset().mockResolvedValue({ data: {} }));

function abrir() {
  return render(<MemoryRouter><NewRecipe /></MemoryRouter>);
}

describe("NewRecipe", () => {
  it("o Switch da Comunidade começa desligado e a receita é salva privada", async () => {
    abrir();
    const sw = screen.getByRole("switch", { name: /publicar na comunidade/i });
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(/seu primeiro nome aparece como autor/i)).toBeInTheDocument();
    const u = userEvent.setup();
    const textos = screen.getAllByRole("textbox");
    await u.type(textos[0], "Bolo");
    await u.type(screen.getAllByRole("textbox").find((t) => t.tagName === "TEXTAREA")!, "Asse");
    await u.click(screen.getByRole("button", { name: /criar receita/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(vi.mocked(api.post).mock.calls[0][1]).toMatchObject({ is_public: false });
  });

  it("ligando o Switch, publica", async () => {
    abrir();
    const u = userEvent.setup();
    await u.click(screen.getByRole("switch", { name: /publicar na comunidade/i }));
    await u.type(screen.getAllByRole("textbox")[0], "Bolo");
    await u.type(screen.getAllByRole("textbox").find((t) => t.tagName === "TEXTAREA")!, "Asse");
    await u.click(screen.getByRole("button", { name: /criar receita/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(vi.mocked(api.post).mock.calls[0][1]).toMatchObject({ is_public: true });
  });
});
