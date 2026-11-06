import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFoodSearch } from "./useFoodSearch";
import { api } from "./api";

vi.mock("./ia", () => ({ IA_DISPONIVEL: false }));
vi.mock("./api", () => ({ api: { get: vi.fn(), post: vi.fn() } }));

describe("useFoodSearch com a IA desligada", () => {
  it("resolveWithAi recusa e não chama a API", async () => {
    const { result } = renderHook(() => useFoodSearch());
    await expect(result.current.resolveWithAi("g")).rejects.toThrow(/manutenção/);
    expect(api.post).not.toHaveBeenCalled();
  });
});
