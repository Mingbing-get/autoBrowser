import { describe, expect, it, vi } from "vitest";
import { createNativeKeyboardExecutor } from "../src/input/native-keyboard-executor.js";

describe("createNativeKeyboardExecutor", () => {
  it("types ascii text one character at a time with varied delays", async () => {
    const typed: string[] = [];
    const delays: number[] = [];
    const robotApi = {
      typeString(text: string) {
        typed.push(text);
      },
      keyTap() {}
    };

    const executor = createNativeKeyboardExecutor({
      platform: "darwin",
      robotApi,
      random: vi.fn()
        .mockReturnValueOnce(0.15)
        .mockReturnValueOnce(0.93)
        .mockReturnValueOnce(0.42)
        .mockReturnValueOnce(0.28)
        .mockReturnValueOnce(0.67)
        .mockReturnValue(0.31),
      sleep: async (delayMs) => {
        delays.push(delayMs);
      },
      readInputSource: async () => ({
        kind: "keyboardLayout",
        id: "com.apple.keylayout.ABC",
        localizedName: "ABC"
      })
    });

    const result = await executor.typeText("a1b");

    expect(typed).toEqual(["a", "1", "b"]);
    expect(delays.length).toBeGreaterThanOrEqual(3);
    expect(new Set(delays).size).toBeGreaterThan(1);
    expect(result.strategy).toBe("keystroke");
  });

  it("pastes with command+v on mac", async () => {
    const events: string[] = [];
    const executor = createNativeKeyboardExecutor({
      platform: "darwin",
      clipboardApi: {
        copy(text: string, callback: (error?: Error | null) => void) {
          events.push(`copy:${text}`);
          callback(null);
        }
      },
      robotApi: {
        typeString(text: string) {
          events.push(`typed:${text}`);
        },
        keyTap(key: string, modifier?: string | string[]) {
          events.push(`keyTap:${key}:${Array.isArray(modifier) ? modifier.join("+") : modifier ?? ""}`);
        }
      },
      sleep: async () => {},
      readInputSource: async () => ({
        kind: "inputMode",
        id: "com.apple.inputmethod.SCIM.ITABC",
        localizedName: "拼音"
      })
    });

    const result = await executor.typeText("中文");

    expect(events).toEqual(["copy:中文", "keyTap:v:command"]);
    expect(result.strategy).toBe("paste");
    expect(result.inputSource?.localizedName).toBe("拼音");
  });

  it("uses control+v for paste on windows", async () => {
    const events: string[] = [];
    const executor = createNativeKeyboardExecutor({
      platform: "win32",
      clipboardApi: {
        copy(text: string, callback: (error?: Error | null) => void) {
          events.push(`copy:${text}`);
          callback(null);
        }
      },
      robotApi: {
        typeString() {},
        keyTap(key: string, modifier?: string | string[]) {
          events.push(`keyTap:${key}:${Array.isArray(modifier) ? modifier.join("+") : modifier ?? ""}`);
        }
      },
      sleep: async () => {}
    });

    const result = await executor.typeText("中文");

    expect(events).toEqual(["copy:中文", "keyTap:v:control"]);
    expect(result.strategy).toBe("paste");
  });
});
