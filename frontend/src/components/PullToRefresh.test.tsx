import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { PullToRefresh } from "./PullToRefresh";

function puxar(el: HTMLElement, dedoPx: number) {
  fireEvent.touchStart(el, { touches: [{ clientY: 0 }] });
  fireEvent.touchMove(el, { touches: [{ clientY: dedoPx }] });
  fireEvent.touchEnd(el);
}

describe("PullToRefresh", () => {
  it("com 96 px de deslocamento ou mais, soltar chama onRefresh", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(
      <PullToRefresh onRefresh={onRefresh}>
        <p>conteúdo</p>
      </PullToRefresh>,
    );
    const alvo = screen.getByText("conteúdo").parentElement as HTMLElement;
    await act(async () => puxar(alvo, 200)); // 200 px de dedo = 100 px de arrasto
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("soltar antes do gatilho não atualiza", async () => {
    const onRefresh = vi.fn();
    render(
      <PullToRefresh onRefresh={onRefresh}>
        <p>conteúdo</p>
      </PullToRefresh>,
    );
    const alvo = screen.getByText("conteúdo").parentElement as HTMLElement;
    await act(async () => puxar(alvo, 120)); // 60 px de arrasto
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
