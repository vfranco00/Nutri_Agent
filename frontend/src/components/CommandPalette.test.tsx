import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { CommandPalette } from "./CommandPalette";

vi.mock("../lib/AuthContext", () => ({ useAuth: () => ({ user: { is_superuser: false } }) }));

const montar = (open: boolean) => (
  <MemoryRouter>
    <CommandPalette open={open} onClose={() => {}} />
  </MemoryRouter>
);

describe("CommandPalette", () => {
  it("não renderiza fechada", () => {
    const { container } = render(montar(false));
    expect(container).toBeEmptyDOMElement();
  });
  it("reabre com a busca limpa", async () => {
    const { rerender } = render(montar(true));
    const u = userEvent.setup();
    await u.type(screen.getByRole("textbox"), "zzz");
    expect(screen.getByRole("textbox")).toHaveValue("zzz");
    rerender(montar(false));
    rerender(montar(true));
    expect(screen.getByRole("textbox")).toHaveValue("");
  });
});
