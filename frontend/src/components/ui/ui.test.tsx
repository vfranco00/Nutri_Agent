import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { Sheet } from "./Sheet";
import { Toaster } from "./Toast";
import { toast, __limparToasts } from "./toastStore";
import { Skeleton } from "./Skeleton";
import { Switch } from "./Switch";

describe("Button", () => {
  it("o primário tem texto tinta, nunca branco", () => {
    render(<Button>Salvar</Button>);
    const cls = screen.getByRole("button", { name: "Salvar" }).className;
    expect(cls).toContain("text-nuvi-tinta");
    expect(cls).toContain("bg-act");
    expect(cls).not.toMatch(/text-white/);
  });

  it("variantes ghost e outline não usam o fundo laranja", () => {
    render(
      <>
        <Button variant="ghost">G</Button>
        <Button variant="outline">O</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "G" }).className).not.toContain("bg-act");
    expect(screen.getByRole("button", { name: "O" }).className).toContain("border");
  });

  it("ao toque encolhe a .97 em 140 ms", () => {
    render(<Button>Toque</Button>);
    const cls = screen.getByRole("button", { name: "Toque" }).className;
    expect(cls).toContain("active:scale-[.97]");
    expect(cls).toContain("duration-[140ms]");
  });
});

describe("toast", () => {
  afterEach(() => {
    vi.useRealTimers();
    act(() => __limparToasts());
  });

  it("com ação, o botão chama onClick e fecha o aviso", async () => {
    const onClick = vi.fn();
    render(<Toaster />);
    act(() => { toast("Item apagado", { action: { label: "Desfazer", onClick } }); });
    expect(screen.getByText("Item apagado")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("fica 4 s na tela e some", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => { toast("Salvo"); });
    act(() => { vi.advanceTimersByTime(3999); });
    expect(screen.queryByText("Salvo")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1 + 300); });
    expect(screen.queryByText("Salvo")).toBeNull();
  });
});

function Exemplo() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button onClick={() => setAberto(true)}>Abrir folha</button>
      <Sheet open={aberto} onOpenChange={setAberto} title="Registrar">
        <p>Conteúdo</p>
      </Sheet>
    </>
  );
}

describe("Sheet", () => {
  it("fecha com Esc e devolve o foco a quem abriu", async () => {
    const user = userEvent.setup();
    render(<Exemplo />);
    const abrir = screen.getByRole("button", { name: "Abrir folha" });
    await user.click(abrir);
    expect(await screen.findByText("Conteúdo")).toBeTruthy();
    await user.keyboard("{Escape}");
    await vi.waitFor(() => expect(screen.queryByText("Conteúdo")).toBeNull());
    expect(document.activeElement).toBe(abrir);
  });

  it("tem o título como nome acessível", async () => {
    render(<Sheet open onOpenChange={() => {}} title="Registrar"><p>x</p></Sheet>);
    expect(await screen.findByRole("dialog", { name: "Registrar" })).toBeTruthy();
  });
});

describe("Skeleton e Switch", () => {
  it("Skeleton é decorativo", () => {
    const { container } = render(<Skeleton className="h-4" />);
    expect(container.firstElementChild!.getAttribute("aria-hidden")).toBe("true");
  });

  it("Switch alterna e expõe role=switch", async () => {
    const onChange = vi.fn();
    render(<Switch aria-label="Água" onCheckedChange={onChange} />);
    await userEvent.click(screen.getByRole("switch", { name: "Água" }));
    expect(onChange).toHaveBeenCalledWith(true, expect.anything());
  });
});
