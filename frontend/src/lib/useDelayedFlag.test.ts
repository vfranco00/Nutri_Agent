import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useDelayedFlag } from "./useDelayedFlag";

describe("useDelayedFlag", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("false aos 299 ms e true aos 300 ms", () => {
    const { result } = renderHook(() => useDelayedFlag(true));
    act(() => { vi.advanceTimersByTime(299); });
    expect(result.current).toBe(false);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe(true);
  });

  it("volta a false na hora quando active desliga", () => {
    const { result, rerender } = renderHook(({ a }) => useDelayedFlag(a), { initialProps: { a: true } });
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe(true);
    rerender({ a: false });
    expect(result.current).toBe(false);
  });

  it("se active desliga antes do prazo, nunca liga", () => {
    const { result, rerender } = renderHook(({ a }) => useDelayedFlag(a), { initialProps: { a: true } });
    act(() => { vi.advanceTimersByTime(200); });
    rerender({ a: false });
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe(false);
  });
});
