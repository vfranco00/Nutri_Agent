import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Profile } from "./Profile";
import { AlertProvider } from "../lib/AlertContext";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.put).mockReset();
  vi.mocked(api.post).mockReset();
  // Simula um usuário novo, sem perfil/histórico ainda — o componente trata isso
  // com try/catch próprios e segue renderizando o formulário normalmente.
  vi.mocked(api.get).mockRejectedValue(new Error("not found"));
});

async function renderReadyProfile() {
  // Profile chama useSearchParams() (para detectar ?onboarding=1), então precisa
  // de um Router no contexto — sem ele o componente lança antes de renderizar.
  const utils = render(
    <MemoryRouter>
      <AlertProvider>
        <Profile />
      </AlertProvider>
    </MemoryRouter>,
  );
  await waitFor(() =>
    expect(screen.getByText("Salvar Perfil e Histórico")).toBeInTheDocument(),
  );
  return utils;
}

async function fillRequiredNumericFields(container: HTMLElement, user: ReturnType<typeof userEvent.setup>) {
  const [ageInput, weightInput, heightInput] = Array.from(
    container.querySelectorAll('input[type="number"]'),
  ) as HTMLInputElement[];
  await user.type(ageInput, "30");
  await user.type(weightInput, "80");
  await user.type(heightInput, "180");
}

describe("Profile preference validation", () => {
  it("blocks saving when allergies is numbers-only", async () => {
    const user = userEvent.setup();
    const { container } = await renderReadyProfile();

    await fillRequiredNumericFields(container, user);

    const allergiesInput = screen
      .getByText("Alergias (Separar por vírgula)")
      .nextElementSibling as HTMLInputElement;
    await user.type(allergiesInput, "123");

    await user.click(screen.getByText("Salvar Perfil e Histórico"));

    expect(
      await screen.findByText(/deve conter texto \(ex: nomes de alimentos\)/i),
    ).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });

  it("allows saving when allergies has real text", async () => {
    vi.mocked(api.put).mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    const { container } = await renderReadyProfile();

    await fillRequiredNumericFields(container, user);

    const allergiesInput = screen
      .getByText("Alergias (Separar por vírgula)")
      .nextElementSibling as HTMLInputElement;
    await user.type(allergiesInput, "Lactose");

    await user.click(screen.getByText("Salvar Perfil e Histórico"));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/profiles/me", expect.any(Object)));
  });
});
