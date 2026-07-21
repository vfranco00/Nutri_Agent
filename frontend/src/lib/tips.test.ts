import { describe, it, expect } from "vitest";
import { getRandomTip, NUTRITION_TIPS } from "./tips";

describe("getRandomTip", () => {
  it("always returns a tip from the list", () => {
    for (let i = 0; i < 20; i++) {
      expect(NUTRITION_TIPS).toContain(getRandomTip());
    }
  });

  it("never repeats the excluded tip when there is more than one option", () => {
    const first = getRandomTip();
    for (let i = 0; i < 20; i++) {
      expect(getRandomTip(first)).not.toBe(first);
    }
  });
});
