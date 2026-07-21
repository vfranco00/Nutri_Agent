import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Register } from "./Register";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: { post: vi.fn() },
}));

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  { password, confirmPassword }: { password: string; confirmPassword: string },
) {
  await user.type(screen.getByPlaceholderText("Seu Nome"), "Franco Teste");
  await user.type(screen.getByPlaceholderText("seu@email.com"), "franco@example.com");
  const [passwordInput, confirmInput] = screen.getAllByPlaceholderText("••••••••");
  await user.type(passwordInput, password);
  await user.type(confirmInput, confirmPassword);
  await user.click(screen.getByRole("button", { name: /cadastrar/i }));
}

beforeEach(() => {
  vi.mocked(api.post).mockReset();
});

describe("Register", () => {
  it("blocks submit when passwords don't match", async () => {
    const user = userEvent.setup();
    render(<Register />);

    await fillForm(user, { password: "strongpassword123", confirmPassword: "outrasenha" });

    expect(await screen.findByText("As senhas não coincidem.")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("shows the success panel after registering", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    render(<Register />);

    await fillForm(user, { password: "strongpassword123", confirmPassword: "strongpassword123" });

    expect(await screen.findByText("Quase lá!")).toBeInTheDocument();
    expect(screen.getByText(/franco@example.com/)).toBeInTheDocument();
  });

  it("shows a readable message on a 422 validation error without crashing", async () => {
    // Regressão: `detail` de um 422 do Pydantic vem como array de objetos,
    // não como string — renderizar isso direto quebrava a página.
    vi.mocked(api.post).mockRejectedValue({
      response: {
        data: {
          detail: [{ msg: "String should have at least 8 characters", type: "string_too_short" }],
        },
      },
    });
    const user = userEvent.setup();
    render(<Register />);

    await fillForm(user, { password: "123456", confirmPassword: "123456" });

    // não deve mostrar o painel de sucesso...
    expect(screen.queryByText("Quase lá!")).not.toBeInTheDocument();
    // ...e deve mostrar uma mensagem de texto legível, não um objeto/erro não tratado
    expect(await screen.findByText("String should have at least 8 characters")).toBeInTheDocument();
  });
});
