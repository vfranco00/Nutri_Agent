import { describe, it, expect } from "vitest";
import { buildSparkline } from "./sparkline";

describe("buildSparkline", () => {
  it("refuses to draw a trend from a single point", () => {
    expect(buildSparkline([80])).toBeNull();
    expect(buildSparkline([])).toBeNull();
  });

  it("maps the highest weight to the top of the box and the lowest to the bottom", () => {
    const s = buildSparkline([82, 78], 120, 36);
    // y cresce para baixo em SVG: o maior valor fica em y=0.
    expect(s?.path).toBe("M0.0,0.0 L120.0,36.0");
  });

  it("reports a loss as a negative delta", () => {
    const s = buildSparkline([82, 78.4]);
    expect(s?.delta).toBe(-3.6);
    expect(s?.first).toBe(82);
    expect(s?.last).toBe(78.4);
  });

  it("centres a flat series instead of dividing by zero", () => {
    const s = buildSparkline([75, 75, 75], 120, 36);
    expect(s?.path).toBe("M0.0,18.0 L60.0,18.0 L120.0,18.0");
  });

  it("puts the end marker on the last point", () => {
    const s = buildSparkline([80, 79, 78], 120, 36);
    expect(s?.lastX).toBe(120);
    expect(s?.lastY).toBe(36);
  });
});
