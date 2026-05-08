import { describe, expect, it } from "vitest";
import {
  createRandomPointPair,
  isPointWithinHitRadius,
  toRelativePoint
} from "../src/options/recording.js";

describe("options recording helpers", () => {
  it("generates two points inside the visible bounds with minimum spacing", () => {
    let index = 0;
    const randomValues = [0.1, 0.2, 0.8, 0.7];
    const pair = createRandomPointPair(
      { width: 600, height: 400 },
      {
        random: () => randomValues[index++] ?? 0.5
      }
    );

    expect(pair.start.x).toBeGreaterThanOrEqual(24);
    expect(pair.start.y).toBeGreaterThanOrEqual(24);
    expect(pair.end.x).toBeLessThanOrEqual(576);
    expect(pair.end.y).toBeLessThanOrEqual(376);
    expect(Math.hypot(pair.end.x - pair.start.x, pair.end.y - pair.start.y)).toBeGreaterThanOrEqual(120);
  });

  it("maps a window mouse position into canvas-relative coordinates", () => {
    expect(
      toRelativePoint(
        { clientX: 120, clientY: 90 },
        { left: 40, top: 20, width: 300, height: 200 }
      )
    ).toEqual({ x: 80, y: 70 });
  });

  it("detects when the cursor enters a point hit radius", () => {
    expect(
      isPointWithinHitRadius(
        { x: 100, y: 100 },
        { x: 110, y: 108 }
      )
    ).toBe(true);

    expect(
      isPointWithinHitRadius(
        { x: 100, y: 100 },
        { x: 140, y: 140 }
      )
    ).toBe(false);
  });
});
