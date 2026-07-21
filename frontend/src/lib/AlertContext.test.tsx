import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertProvider, useAlert } from "./AlertContext";

function ShowAlertButton() {
  const { showAlert } = useAlert();
  return (
    <button onClick={() => showAlert("Perfil salvo!", "success", 50)}>Disparar Alerta</button>
  );
}

function ConfirmButton({ onResult }: { onResult: (result: boolean) => void }) {
  const { confirmDialog } = useAlert();
  return (
    <button
      onClick={async () => {
        const result = await confirmDialog("Tem certeza?", { danger: true });
        onResult(result);
      }}
    >
      Perguntar
    </button>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("AlertContext", () => {
  it("shows a toast with the given message and auto-dismisses", async () => {
    const user = userEvent.setup();
    render(
      <AlertProvider>
        <ShowAlertButton />
      </AlertProvider>,
    );

    await user.click(screen.getByText("Disparar Alerta"));
    expect(await screen.findByText("Perfil salvo!")).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByText("Perfil salvo!")).not.toBeInTheDocument(), {
      timeout: 1000,
    });
  });

  it("confirmDialog resolves true when the confirm button is clicked", async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(
      <AlertProvider>
        <ConfirmButton onResult={onResult} />
      </AlertProvider>,
    );

    await user.click(screen.getByText("Perguntar"));
    expect(await screen.findByText("Tem certeza?")).toBeInTheDocument();

    await user.click(screen.getByText("Confirmar"));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
  });

  it("confirmDialog resolves false when cancel is clicked", async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(
      <AlertProvider>
        <ConfirmButton onResult={onResult} />
      </AlertProvider>,
    );

    await user.click(screen.getByText("Perguntar"));
    await screen.findByText("Tem certeza?");

    await user.click(screen.getByText("Cancelar"));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });
});
