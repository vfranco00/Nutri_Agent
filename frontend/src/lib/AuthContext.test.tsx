import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "./AuthContext";
import { api } from "./api";

vi.mock("./api", () => ({
  api: { get: vi.fn() },
}));

function TestConsumer() {
  const { user, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="user-email">{user?.email ?? "sem-usuario"}</span>
      <button onClick={() => login("fake-token-123")}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(api.get).mockReset();
});

describe("AuthContext", () => {
  it("login stores the token and loads the user", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { email: "user@example.com" } });
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await user.click(screen.getByText("Login"));

    expect(localStorage.getItem("nutri_token")).toBe("fake-token-123");
    await waitFor(() =>
      expect(screen.getByTestId("user-email")).toHaveTextContent("user@example.com"),
    );
  });

  it("logout clears BOTH the auth token and the cached meal plan", async () => {
    // Regressão: um plano gerado pelo usuário A não pode sobreviver no localStorage
    // pro próximo usuário que logar no mesmo navegador.
    vi.mocked(api.get).mockResolvedValue({ data: { email: "user@example.com" } });
    localStorage.setItem("nutri_token", "token-existente");
    localStorage.setItem("nutri_current_plan", JSON.stringify({ days: [] }));

    const user = userEvent.setup();
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await user.click(screen.getByText("Logout"));

    expect(localStorage.getItem("nutri_token")).toBeNull();
    expect(localStorage.getItem("nutri_current_plan")).toBeNull();
  });
});
