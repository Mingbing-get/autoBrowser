import { describe, expect, it, vi, afterEach } from "vitest";

const { httpRequestMock } = vi.hoisted(() => ({
  httpRequestMock: vi.fn()
}));

vi.mock("node:http", () => ({
  request: httpRequestMock
}));

import { createHttpClient } from "../src/client/http-client.js";

afterEach(() => {
  httpRequestMock.mockReset();
});

describe("createHttpClient", () => {
  it.each([
    ["open", { url: "https://example.com" }, "/commands/open"],
    ["close", {}, "/commands/close"],
    ["tabs", {}, "/commands/tabs"],
    ["query", { selector: "#app" }, "/commands/query"],
    ["summary", {}, "/commands/summary"],
    ["text", { selector: "#app" }, "/commands/text"],
    ["rect", { selector: "#app" }, "/commands/rect"],
    ["click", { selector: "#app" }, "/commands/click"],
    ["input", { selector: "#app", value: "hello" }, "/commands/input"]
  ] as const)("posts %s requests to %s", async (command, payload, expectedPath) => {
    httpRequestMock.mockImplementation((options, callback) => {
      const responseHandlers = new Map<string, (...args: unknown[]) => void>();
      const response = {
        on(event: string, handler: (...args: unknown[]) => void) {
          responseHandlers.set(event, handler);
          return response;
        }
      };

      callback(response);

      return {
        on: vi.fn(),
        write: vi.fn(),
        end: vi.fn(() => {
          responseHandlers.get("data")?.(Buffer.from(JSON.stringify({ ok: true })));
          responseHandlers.get("end")?.();
        })
      };
    });

    const client = createHttpClient("http://127.0.0.1:3210");
    const result = await client.request(command, payload);

    expect(result).toEqual({ ok: true });
    expect(httpRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expectedPath,
        method: "POST"
      }),
      expect.any(Function)
    );
  });

  it("throws for commands without an HTTP route mapping", async () => {
    const client = createHttpClient("http://127.0.0.1:3210");

    await expect(client.request("clickMapStart", {})).rejects.toThrow(
      "unsupported HTTP command: clickMapStart"
    );
  });
});
