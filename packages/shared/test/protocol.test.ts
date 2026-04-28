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
    const message = createCommandMessage("req_3", "summary", {
      tabId: 12
    });

    expect(message.command).toBe("summary");
    expect(message.payload).toEqual({
      tabId: 12
    });
    expect(isCommandMessage(message)).toBe(true);
  });

  it("recognizes the text command", () => {
    const message = createCommandMessage("req_4", "text", {
      selector: "#s-hotsearch-wrapper"
    });

    expect(message.command).toBe("text");
    expect(isCommandMessage(message)).toBe(true);
  });

  it("recognizes the selector command", () => {
    const message = createCommandMessage("req_5", "selector", {
      selector: "#app",
      tabId: 9
    });

    expect(message.command).toBe("selector");
    expect(message.payload).toEqual({
      selector: "#app",
      tabId: 9
    });
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
