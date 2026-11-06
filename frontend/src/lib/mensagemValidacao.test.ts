import { describe, expect, it } from "vitest";
import { limparMensagemValidacao } from "./mensagemValidacao";

describe("limparMensagemValidacao", () => {
  it("tira o prefixo 'Value error,'", () => {
    expect(limparMensagemValidacao("Value error, Código de barras inválido.")).toBe("Código de barras inválido.");
  });
  it("traduz e-mail inválido", () => {
    expect(
      limparMensagemValidacao("value is not a valid email address: The part after the @-sign is a special-use or reserved name"),
    ).toBe("Informe um e-mail válido.");
  });
  it("devolve vazio sem mensagem", () => {
    expect(limparMensagemValidacao(undefined)).toBe("");
  });
});
