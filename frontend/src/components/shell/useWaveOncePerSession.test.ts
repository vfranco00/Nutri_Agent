import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { __resetWaveOnce, useWaveOncePerSession } from "./useWaveOncePerSession";

describe("useWaveOncePerSession", () => {
  beforeEach(() => {
    sessionStorage.clear();
    __resetWaveOnce();
    window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
  });

  it("liga a onda na primeira montagem da sessão e não na segunda", () => {
    expect(renderHook(() => useWaveOncePerSession()).result.current).toBe("once");
    expect(renderHook(() => useWaveOncePerSession()).result.current).toBe(false);
  });

  it("não repete numa página recarregada da mesma sessão", () => {
    sessionStorage.setItem("nuvi_onda_logo", "1");
    expect(renderHook(() => useWaveOncePerSession()).result.current).toBe(false);
  });

  it("no PWA instalado não liga (a abertura já faz a onda)", () => {
    window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
    expect(renderHook(() => useWaveOncePerSession()).result.current).toBe(false);
  });
});
