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

  it("recognizes the searchFromPoint command", () => {
    const message = createCommandMessage("req_3b", "searchFromPoint", {
      x: 120,
      y: 84,
      tabId: 12
    });

    expect(message.command).toBe("searchFromPoint");
    expect(message.payload).toEqual({
      x: 120,
      y: 84,
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

  it("recognizes the rect command", () => {
    const message = createCommandMessage("req_5", "rect", {
      selector: "#app",
      tabId: 9
    });

    expect(message.command).toBe("rect");
    expect(message.payload).toEqual({
      selector: "#app",
      tabId: 9
    });
    expect(isCommandMessage(message)).toBe(true);
  });

  it("recognizes the click command", () => {
    const message = createCommandMessage("req_6", "click", {
      selector: "#submit",
      tabId: 4
    });

    expect(message.command).toBe("click");
    expect(message.payload).toEqual({
      selector: "#submit",
      tabId: 4
    });
    expect(isCommandMessage(message)).toBe(true);
  });

  it("recognizes the clickObserve command", () => {
    const message = createCommandMessage("req_6b", "clickObserve", {
      selector: "#submit",
      tabId: 4,
      observe: {
        minObserveMs: 120,
        stableWindowMs: 200
      }
    });

    expect(message.command).toBe("clickObserve");
    expect(message.payload).toEqual({
      selector: "#submit",
      tabId: 4,
      observe: {
        minObserveMs: 120,
        stableWindowMs: 200
      }
    });
    expect(isCommandMessage(message)).toBe(true);
  });

  it("recognizes the clickObserveStart command", () => {
    const message = createCommandMessage("req_6c", "clickObserveStart", {
      selector: "#submit",
      tabId: 4
    });

    expect(message.command).toBe("clickObserveStart");
    expect(isCommandMessage(message)).toBe(true);
  });

  it("recognizes the clickObserveFinish command", () => {
    const message = createCommandMessage("req_6d", "clickObserveFinish", {
      tabId: 4,
      awaitStability: true,
      observe: {
        stableWindowMs: 200
      }
    });

    expect(message.command).toBe("clickObserveFinish");
    expect(isCommandMessage(message)).toBe(true);
  });

  it("recognizes the drag command with a target selector anchor", () => {
    const message = createCommandMessage("req_6e", "drag", {
      selector: "#item",
      targetSelector: "#dropzone",
      direction: "br",
      tabId: 4,
      observe: {
        maxObserveMs: 1200
      }
    });

    expect(message.command).toBe("drag");
    expect(message.payload).toEqual({
      selector: "#item",
      targetSelector: "#dropzone",
      direction: "br",
      tabId: 4,
      observe: {
        maxObserveMs: 1200
      }
    });
    expect(isCommandMessage(message)).toBe(true);
  });

  it("recognizes the drag command with viewport coordinates", () => {
    const message = createCommandMessage("req_6f", "drag", {
      selector: "#item",
      x: 123,
      y: 456
    });

    expect(message.command).toBe("drag");
    expect(message.payload).toEqual({
      selector: "#item",
      x: 123,
      y: 456
    });
    expect(isCommandMessage(message)).toBe(true);
  });

  it("recognizes the input command", () => {
    const message = createCommandMessage("req_7", "input", {
      selector: "#search",
      value: "hello world",
      tabId: 11
    });

    expect(message.command).toBe("input");
    expect(message.payload).toEqual({
      selector: "#search",
      value: "hello world",
      tabId: 11
    });
    expect(isCommandMessage(message)).toBe(true);
  });

  it("recognizes the upload command", () => {
    const message = createCommandMessage("req_7_upload", "upload", {
      selector: "#upload",
      filepath: "/tmp/demo.txt",
      tabId: 11
    });

    expect(message.command).toBe("upload");
    expect(message.payload).toEqual({
      selector: "#upload",
      filepath: "/tmp/demo.txt",
      tabId: 11
    });
    expect(isCommandMessage(message)).toBe(true);
  });

  it("recognizes the flow command", () => {
    const message = createCommandMessage("req_8", "flow", {
      steps: [
        {
          action: "open",
          url: "https://example.com"
        },
        {
          action: "tabs"
        },
        {
          action: "search",
          text: "hello"
        },
        {
          action: "search-from-point",
          x: 120,
          y: 84
        },
        {
          action: "input",
          selector: "#search",
          value: "hello"
        },
        {
          action: "upload",
          selector: "#upload",
          filepath: "/tmp/demo.txt"
        },
        {
          action: "scroll",
          deltaX: 0,
          deltaY: 240,
          tabId: 5
        },
        {
          action: "click-observe",
          selector: "#submit",
          tabId: 5,
          observe: {
            maxObserveMs: 1500
          }
        },
        {
          action: "rect",
          selector: "#submit",
          tabId: 5
        },
        {
          action: "click",
          selector: "#submit",
          tabId: 5
        },
        {
          action: "drag",
          selector: "#item",
          targetSelector: "#dropzone",
          direction: "bl",
          tabId: 5
        }
      ]
    });

    expect(message.command).toBe("flow");
    expect(message.payload).toEqual({
      steps: [
        {
          action: "open",
          url: "https://example.com"
        },
        {
          action: "tabs"
        },
        {
          action: "search",
          text: "hello"
        },
        {
          action: "search-from-point",
          x: 120,
          y: 84
        },
        {
          action: "input",
          selector: "#search",
          value: "hello"
        },
        {
          action: "upload",
          selector: "#upload",
          filepath: "/tmp/demo.txt"
        },
        {
          action: "scroll",
          deltaX: 0,
          deltaY: 240,
          tabId: 5
        },
        {
          action: "click-observe",
          selector: "#submit",
          tabId: 5,
          observe: {
            maxObserveMs: 1500
          }
        },
        {
          action: "rect",
          selector: "#submit",
          tabId: 5
        },
        {
          action: "click",
          selector: "#submit",
          tabId: 5
        },
        {
          action: "drag",
          selector: "#item",
          targetSelector: "#dropzone",
          direction: "bl",
          tabId: 5
        }
      ]
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
