import { describe, expect, it } from "vitest";
import { createNativeClickExecutor } from "../src/click/native-click-executor.js";

describe("createNativeClickExecutor", () => {
  it("waits briefly at the target before clicking", async () => {
    const events: string[] = [];
    const delays: number[] = [];
    const robotApi = {
      getMousePos() {
        return { x: 0, y: 0 };
      },
      moveMouse() {
        events.push("move");
      },
      mouseClick() {
        events.push("click");
      }
    };

    const executor = createNativeClickExecutor({
      random: () => 0.5,
      sleep: async (delayMs) => {
        delays.push(delayMs);
        events.push(`sleep:${delayMs}`);
      },
      hoverDelayMs: 40,
      robotApi
    } as never);

    await executor.clickAtScreenPoint({ x: 120, y: 80 });

    expect(events.at(-1)).toBe("click");
    expect(delays).toContain(40);
    expect(events.at(-2)).toBe("sleep:40");
  });
});
