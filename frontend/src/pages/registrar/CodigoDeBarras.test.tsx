import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { CodigoDeBarras } from "./CodigoDeBarras";
import { api } from "../../lib/api";

vi.mock("../../lib/api", () => ({ api: { get: vi.fn() } }));

function Local() {
  const l = useLocation();
  return <div data-testid="local">{l.pathname + l.search}</div>;
}

function montar() {
  return render(
    <MemoryRouter initialEntries={["/registrar/codigo-de-barras"]}>
      <Routes>
        <Route path="/registrar/codigo-de-barras" element={<CodigoDeBarras />} />
        <Route path="*" element={<Local />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  // jsdom não tem câmera: getUserMedia não existe -> o campo digitado é a tela principal.
  Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });
});
afterEach(() => vi.restoreAllMocks());

describe("CodigoDeBarras", () => {
  it("sem câmera mostra o campo de digitar", () => {
    montar();
    expect(screen.getByLabelText("Digite o código")).toBeInTheDocument();
  });

  it("permissão negada mostra o campo", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: vi.fn().mockRejectedValue(Object.assign(new Error("x"), { name: "NotAllowedError" })) },
      configurable: true,
    });
    montar();
    expect(await screen.findByText(/câmera não está liberada/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Digite o código")).toBeInTheDocument();
  });

  it("código válido consulta a rota e navega para o alimento", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { food_ref: "cache:7", name: "Iogurte" } });
    montar();
    await userEvent.type(screen.getByLabelText("Digite o código"), "7891097000123");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(api.get).toHaveBeenCalledWith("/diary/foods/barcode/7891097000123");
    await waitFor(() => expect(screen.getByTestId("local")).toHaveTextContent("/registrar/alimento/cache%3A7"));
  });

  it("404 oferece cadastrar como meu alimento com o barcode", async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 404 } });
    montar();
    await userEvent.type(screen.getByLabelText("Digite o código"), "7891097000123");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    const link = await screen.findByRole("link", { name: "Cadastrar como meu alimento" });
    expect(link).toHaveAttribute("href", "/alimentos/novo?barcode=7891097000123");
  });

  it("503 mostra tentar de novo", async () => {
    vi.mocked(api.get).mockRejectedValueOnce({ response: { status: 503 } });
    montar();
    await userEvent.type(screen.getByLabelText("Digite o código"), "7891097000123");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(await screen.findByText("Não deu para consultar agora")).toBeInTheDocument();
    vi.mocked(api.get).mockResolvedValue({ data: { food_ref: "cache:7" } });
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });

  it("código com menos de 8 dígitos não envia", async () => {
    montar();
    await userEvent.type(screen.getByLabelText("Digite o código"), "1234567");
    expect(screen.getByRole("button", { name: "Buscar" })).toBeDisabled();
    expect(api.get).not.toHaveBeenCalled();
  });
});
