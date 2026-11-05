import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SwipeRow } from "./SwipeRow";

function arrastar(el: HTMLElement, de: number, ate: number) {
  fireEvent.pointerDown(el, { clientX: de, clientY: 10, pointerId: 1 });
  fireEvent.pointerMove(el, { clientX: ate, clientY: 12, pointerId: 1 });
  fireEvent.pointerUp(el, { clientX: ate, clientY: 12, pointerId: 1 });
}

describe("SwipeRow", () => {
  it("arrastar além do limite apaga", () => {
    const onDelete = vi.fn();
    render(<SwipeRow label="arroz" onDelete={onDelete}>arroz</SwipeRow>);
    arrastar(screen.getByTestId("swipe-conteudo"), 300, 150);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
  it("soltar antes do limite não apaga", () => {
    const onDelete = vi.fn();
    render(<SwipeRow label="arroz" onDelete={onDelete}>arroz</SwipeRow>);
    arrastar(screen.getByTestId("swipe-conteudo"), 300, 260);
    expect(onDelete).not.toHaveBeenCalled();
  });
  it("rolar na vertical não apaga", () => {
    const onDelete = vi.fn();
    render(<SwipeRow label="arroz" onDelete={onDelete}>arroz</SwipeRow>);
    const el = screen.getByTestId("swipe-conteudo");
    fireEvent.pointerDown(el, { clientX: 300, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(el, { clientX: 270, clientY: 80, pointerId: 1 });
    fireEvent.pointerUp(el, { clientX: 270, clientY: 80, pointerId: 1 });
    expect(onDelete).not.toHaveBeenCalled();
  });
  it("tem botão acessível para quem não arrasta", () => {
    const onDelete = vi.fn();
    render(<SwipeRow label="arroz" onDelete={onDelete}>arroz</SwipeRow>);
    fireEvent.click(screen.getByRole("button", { name: "Apagar arroz" }));
    expect(onDelete).toHaveBeenCalled();
  });
});
