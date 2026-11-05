import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Splash, SplashGate } from "./Splash";

const auth = { loading: true };
vi.mock("../../lib/AuthContext", () => ({ useAuth: () => auth }));

function mockMatchMedia(matches: (q: string) => boolean) {
  window.matchMedia = ((q: string) => ({
    matches: matches(q),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const temOnda = (c: HTMLElement) => !!c.querySelector(".nuvi-wave");

describe("Splash", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMatchMedia(() => false);
  });
  afterEach(() => {
    vi.useRealTimers();
    // @ts-expect-error limpeza do stub de teste
    delete Element.prototype.animate;
  });

  it("com ready já verdadeiro, a onda não liga", () => {
    const { container } = render(<Splash ready onDone={() => {}} />);
    act(() => { vi.advanceTimersByTime(299); });
    expect(temOnda(container)).toBe(false);
  });

  it("sem ready por 300 ms, a onda liga", () => {
    const { container } = render(<Splash ready={false} onDone={() => {}} />);
    act(() => { vi.advanceTimersByTime(299); });
    expect(temOnda(container)).toBe(false);
    act(() => { vi.advanceTimersByTime(1); });
    expect(temOnda(container)).toBe(true);
  });

  it("sem ready por 8 s, chama onDone", () => {
    const onDone = vi.fn();
    render(<Splash ready={false} onDone={onDone} />);
    act(() => { vi.advanceTimersByTime(7999); });
    expect(onDone).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("com error, sai na hora", () => {
    const onDone = vi.fn();
    render(<Splash ready={false} error onDone={onDone} />);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("com movimento reduzido, a saída é só opacidade em 200 ms", async () => {
    mockMatchMedia((q) => q.includes("prefers-reduced-motion"));
    const animate = vi.fn(() => ({ finished: Promise.resolve(), cancel: () => {} }));
    // @ts-expect-error stub de teste (jsdom não tem WAAPI)
    Element.prototype.animate = animate;
    const onDone = vi.fn();
    render(<Splash ready onDone={onDone} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    const chamadas = animate.mock.calls as unknown as Array<[Keyframe[], KeyframeAnimationOptions]>;
    const saida = chamadas.find(([, o]) => o.duration === 200);
    expect(saida).toBeTruthy();
    for (const [frames] of chamadas) {
      for (const f of frames) {
        expect(Object.keys(f).every((k) => k === "opacity" || k === "offset")).toBe(true);
      }
    }
    expect(onDone).toHaveBeenCalled();
  });
});

describe("SplashGate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    auth.loading = true;
  });
  afterEach(() => vi.useRealTimers());

  it("na Web comum não mostra abertura", () => {
    mockMatchMedia(() => false);
    const { container } = render(<SplashGate />);
    expect(container.firstChild).toBeNull();
  });

  it("no PWA, sem dados por 8 s, a tela mostra o erro com Tentar de novo", () => {
    mockMatchMedia((q) => q.includes("standalone"));
    render(<SplashGate />);
    expect(screen.queryByText(/Tentar de novo/)).toBeNull();
    act(() => { vi.advanceTimersByTime(8000); });
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Tentar de novo/ })).toBeTruthy();
  });
});
