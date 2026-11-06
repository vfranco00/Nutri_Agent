import { describe, it, expect } from "vitest";
import { deslocamentoDoArrasto, gomosAcesos, PTR_GATILHO, PTR_MAX } from "./puxar";

describe("puxar para atualizar", () => {
  it("o arrasto segue o dedo com metade da distância, até 112 px", () => {
    expect(deslocamentoDoArrasto(100)).toBe(50);
    expect(deslocamentoDoArrasto(400)).toBe(PTR_MAX);
    expect(deslocamentoDoArrasto(-30)).toBe(0);
  });

  it("acende um gomo a cada 12 px, no máximo oito", () => {
    expect(gomosAcesos(11)).toBe(0);
    expect(gomosAcesos(12)).toBe(1);
    expect(gomosAcesos(PTR_GATILHO)).toBe(8);
    expect(gomosAcesos(PTR_MAX)).toBe(8);
  });
});
