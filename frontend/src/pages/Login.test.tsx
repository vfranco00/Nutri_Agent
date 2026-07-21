import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Login } from "./Login";
import { AuthProvider } from "../lib/AuthContext";
import { AlertProvider } from "../lib/AlertContext";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

function renderLogin() {
  return render(
    <AlertProvider>
      <AuthProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthProvider>
    </AlertProvider>,
  );
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText("seu@email.com"), "user@example.com");
  await user.type(screen.getByPlaceholderText("••••••••"), "senha123");
  await user.click(screen.getByRole("button", { name: /entrar/i }));
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
});

describe("Login", () => {
  it("shows a generic error on invalid credentials", async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { data: {} } });
    const user = userEvent.setup();
    renderLogin();

    await fillAndSubmit(user);

    expect(await screen.findByText("Email ou senha incorretos.")).toBeInTheDocument();
    expect(screen.queryByText(/reenviar email/i)).not.toBeInTheDocument();
  });

  it("shows the resend button when the API returns EMAIL_NOT_VERIFIED", async () => {
    vi.mocked(api.post).mockRejectedValueOnce({
      response: { data: { detail: { code: "EMAIL_NOT_VERIFIED", message: "Confirme seu email antes de entrar." } } },
    });
    const user = userEvent.setup();
    renderLogin();

    await fillAndSubmit(user);

    expect(await screen.findByText("Confirme seu email antes de entrar.")).toBeInTheDocument();
    const resendButton = screen.getByText(/reenviar email de confirmação/i);
    expect(resendButton).toBeInTheDocument();

    vi.mocked(api.post).mockResolvedValueOnce({ data: { message: "ok" } });
    await user.click(resendButton);

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/auth/resend-verification", { email: "user@example.com" }),
    );
  });

  it("shows an account-disabled message when the API returns ACCOUNT_DISABLED", async () => {
    vi.mocked(api.post).mockRejectedValueOnce({
      response: { data: { detail: { code: "ACCOUNT_DISABLED", message: "Sua conta foi desativada." } } },
    });
    const user = userEvent.setup();
    renderLogin();

    await fillAndSubmit(user);

    expect(await screen.findByText("Sua conta foi desativada.")).toBeInTheDocument();
    expect(screen.queryByText(/reenviar email/i)).not.toBeInTheDocument();
  });
});
