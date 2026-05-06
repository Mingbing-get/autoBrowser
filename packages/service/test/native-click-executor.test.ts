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

  it("scrolls in smaller steps after brief pauses", async () => {
    const scrollCalls: Array<{ x: number; y: number }> = [];
    const delays: number[] = [];
    const robotApi = {
      getMousePos() {
        return { x: 0, y: 0 };
      },
      moveMouse() {},
      mouseClick() {},
      scrollMouse(x: number, y: number) {
        scrollCalls.push({ x, y });
      }
    };

    const executor = createNativeClickExecutor({
      sleep: async (delayMs) => {
        delays.push(delayMs);
      },
      robotApi
    } as never);

    await executor.scrollAtScreenPoint?.({ x: 100, y: -50 });

    expect(scrollCalls.length).toBeGreaterThan(1);
    expect(scrollCalls.reduce((sum, call) => sum + call.x, 0)).toBe(100);
    expect(scrollCalls.reduce((sum, call) => sum + call.y, 0)).toBe(-50);
    expect(scrollCalls.every((call) => Math.abs(call.x) < 100 || Math.abs(call.y) < 50)).toBe(true);
    expect(delays.length).toBe(scrollCalls.length - 1);
  });

  it("toggles the mouse button down at the source point and up at the end", async () => {
    const events: string[] = [];
    const robotApi = {
      getMousePos() {
        return { x: 0, y: 0 };
      },
      moveMouse() {
        events.push("move");
      },
      mouseClick() {},
      scrollMouse() {},
      mouseToggle(state: "down" | "up", button?: string) {
        events.push(`${state}:${button ?? "left"}`);
      }
    };

    const executor = createNativeClickExecutor({
      random: () => 0.5,
      hoverDelayMs: 0,
      robotApi
    } as never);

    await executor.mouseDownAtScreenPoint?.({ x: 50, y: 60 });
    await executor.mouseUp?.();

    expect(events).toContain("down:left");
    expect(events.at(-1)).toBe("up:left");
  });
});
