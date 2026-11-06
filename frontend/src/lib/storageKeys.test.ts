import { beforeEach, describe, expect, it } from "vitest";
import { migrarChavesAntigas, PLAN_KEY, TOKEN_KEY } from "./storageKeys";

function memoria(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => { m.delete(k); },
    setItem: (k, v) => { m.set(k, String(v)); },
  };
}

describe("migrarChavesAntigas", () => {
  let s: Storage;
  beforeEach(() => { s = memoria(); });

  it("move nutri_token e nutri_current_plan para as chaves nuvi_", () => {
    s.setItem("nutri_token", "abc");
    s.setItem("nutri_current_plan", "{}");
    migrarChavesAntigas(s);
    expect(s.getItem(TOKEN_KEY)).toBe("abc");
    expect(s.getItem(PLAN_KEY)).toBe("{}");
    expect(s.getItem("nutri_token")).toBeNull();
  });

  it("não sobrescreve uma chave nova que já existe", () => {
    s.setItem("nutri_token", "velho");
    s.setItem(TOKEN_KEY, "novo");
    migrarChavesAntigas(s);
    expect(s.getItem(TOKEN_KEY)).toBe("novo");
    expect(s.getItem("nutri_token")).toBeNull();
  });
});
