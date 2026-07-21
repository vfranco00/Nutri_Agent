import { describe, it, expect } from "vitest";
import { isFreeText, cleanMarkdown } from "./utils";

describe("isFreeText", () => {
  it("accepts text with letters", () => {
    expect(isFreeText("Lactose")).toBe(true);
    expect(isFreeText("Frango, Batata")).toBe(true);
  });

  it("accepts accented text", () => {
    expect(isFreeText("Glúten, Cebola")).toBe(true);
  });

  it("rejects numbers-only input", () => {
    expect(isFreeText("123")).toBe(false);
  });

  it("rejects symbols-only input", () => {
    expect(isFreeText("!!! ...")).toBe(false);
  });

  it("accepts empty/blank input (optional field)", () => {
    expect(isFreeText("")).toBe(true);
    expect(isFreeText("   ")).toBe(true);
  });
});

describe("cleanMarkdown", () => {
  it("strips common markdown tokens", () => {
    expect(cleanMarkdown("**bold** _and_ `code` #header")).toBe("bold and code header");
  });

  it("handles empty input", () => {
    expect(cleanMarkdown("")).toBe("");
  });
});
