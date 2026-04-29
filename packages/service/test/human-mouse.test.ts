import { describe, expect, it } from "vitest";
import { moveMouseHumanLike, type HumanMouseApi } from "../src/click/human-mouse.js";

describe("moveMouseHumanLike", () => {
  it("follows a curved primary path instead of a straight line", async () => {
    const moves: Array<{ x: number; y: number }> = [];
    const randomValues = [0.85, 0.2, 0.75, 0.5];
    let randomIndex = 0;
    const api: HumanMouseApi = {
      getMousePos() {
        return { x: 0, y: 0 };
      },
      moveMouse(x, y) {
        moves.push({ x, y });
      },
      mouseClick() {}
    };

    await moveMouseHumanLike(api, { x: 180, y: 0 }, {
      random: () => randomValues[randomIndex++] ?? 0.5,
      sleep: async () => {}
    });

    expect(moves.at(-1)).toEqual({ x: 180, y: 0 });

    const middleMoves = moves.slice(0, -1).slice(3, -3);
    expect(middleMoves.length).toBeGreaterThan(0);
    expect(middleMoves.some((point) => Math.abs(point.y) >= 6)).toBe(true);
  });

  it("slows down as the cursor approaches the target", async () => {
    const delays: number[] = [];
    const moves: Array<{ x: number; y: number }> = [];
    const api: HumanMouseApi = {
      getMousePos() {
        return { x: 0, y: 0 };
      },
      moveMouse(x, y) {
        moves.push({ x, y });
      },
      mouseClick() {}
    };

    await moveMouseHumanLike(api, { x: 180, y: 0 }, {
      random: () => 0.5,
      sleep: async (delayMs) => {
        delays.push(delayMs);
      }
    });

    expect(moves.at(-1)).toEqual({ x: 180, y: 0 });
    expect(delays.length).toBeGreaterThan(10);

    const midpoint = Math.floor(delays.length / 2);
    const firstHalfAverage =
      delays.slice(0, midpoint).reduce((sum, delay) => sum + delay, 0) / midpoint;
    const secondHalf = delays.slice(midpoint);
    const secondHalfAverage =
      secondHalf.reduce((sum, delay) => sum + delay, 0) / secondHalf.length;

    expect(secondHalfAverage).toBeGreaterThan(firstHalfAverage);
    expect(delays.at(-1)).toBeGreaterThan(delays[0] ?? 0);
  });
});
