import { describe, expect, it } from "vitest";
import {
  createCommandMessage,
  isCommandMessage,
  isResultMessage
} from "../src/index.js";

describe("shared protocol", () => {
  it("creates a typed open command message", () => {
    const message = createCommandMessage("req_1", "open", {
      url: "https://www.baidu.com"
    });

    expect(message.kind).toBe("command");
    expect(message.requestId).toBe("req_1");
    expect(message.command).toBe("open");
    expect(isCommandMessage(message)).toBe(true);
  });

  it("recognizes the summary command", () => {
    const message = createCommandMessage("req_3", "summary", {});

    expect(message.command).toBe("summary");
    expect(isCommandMessage(message)).toBe(true);
  });

  it("recognizes result messages", () => {
    const result = {
      kind: "result",
      requestId: "req_2",
      ok: true,
      payload: {
        found: true
      }
    };

    expect(isResultMessage(result)).toBe(true);
  });
});
