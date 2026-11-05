import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./api", () => ({
  api: { get: vi.fn(), post: vi.fn(), interceptors: { response: { use: vi.fn() } } },
}));

import { api } from "./api";
import { consentRequiredPurpose, fetchConsents, saveConsent, POLICY_VERSION_ACEITA } from "./consents";

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
});

describe("consents", () => {
  it("reconhece o 403 consent_required e devolve a finalidade", () => {
    const err = { response: { status: 403, data: { detail: "consent_required", purpose: "ia" } } };
    expect(consentRequiredPurpose(err)).toBe("ia");
  });

  it("ignora outros 403 e outros erros", () => {
    expect(consentRequiredPurpose({ response: { status: 403, data: { detail: "forbidden" } } })).toBeNull();
    expect(consentRequiredPurpose({ response: { status: 500, data: {} } })).toBeNull();
    expect(consentRequiredPurpose(new Error("x"))).toBeNull();
  });

  it("fetchConsents lê GET /consents/me", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { policy_version: "v", items: [{ purpose: "ia", granted: true, at: "x" }] } });
    const r = await fetchConsents();
    expect(api.get).toHaveBeenCalledWith("/consents/me");
    expect(r.items[0].purpose).toBe("ia");
  });

  it("saveConsent chama POST /consents/me com finalidade, valor e origem", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { policy_version: "v", items: [] } });
    await saveConsent("push", false, "perfil");
    expect(api.post).toHaveBeenCalledWith("/consents/me", { purpose: "push", granted: false, source: "perfil" });
  });

  it("expõe a versão da política aceita no cadastro", () => {
    expect(POLICY_VERSION_ACEITA).toBe("2026-11-v1");
  });
});

describe("interceptor do 403 consent_required", () => {
  it("pergunta ao usuário e repete a chamada original se ele permitir", async () => {
    const [, onRejected] = vi.mocked(api.interceptors.response.use).mock.calls[0] as unknown as [unknown, (e: unknown) => Promise<unknown>];
    const { subscribePedido, resolverPedido } = await import("./consents");
    (api as unknown as { request: ReturnType<typeof vi.fn> }).request = vi.fn().mockResolvedValue({ data: "ok" });
    const abriu: unknown[] = [];
    subscribePedido((p) => abriu.push(p));
    const err = { config: { url: "/ai/x" }, response: { status: 403, data: { detail: "consent_required", purpose: "ia" } } };
    const p = onRejected(err);
    await Promise.resolve();
    expect(abriu).toContain("ia");
    resolverPedido(true);
    await expect(p).resolves.toEqual({ data: "ok" });
  });

  it("rejeita o erro original se o usuário disser 'Agora não'", async () => {
    const [, onRejected] = vi.mocked(api.interceptors.response.use).mock.calls[0] as unknown as [unknown, (e: unknown) => Promise<unknown>];
    const { resolverPedido } = await import("./consents");
    const err = { config: { url: "/ai/x" }, response: { status: 403, data: { detail: "consent_required", purpose: "ia" } } };
    const p = onRejected(err);
    await Promise.resolve();
    resolverPedido(false);
    await expect(p).rejects.toBe(err);
  });
});
