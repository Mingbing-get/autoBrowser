import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  resolveCommandTab,
  querySelectorInTab,
  summarizePageInTab,
  textContentInTab
} = vi.hoisted(() => ({
  resolveCommandTab: vi.fn(),
  querySelectorInTab: vi.fn(),
  summarizePageInTab: vi.fn(),
  textContentInTab: vi.fn()
}));

vi.mock("../src/adapters/tabs.js", () => ({
  resolveCommandTab
}));

vi.mock("../src/adapters/scripting.js", () => ({
  querySelectorInTab,
  summarizePageInTab,
  textContentInTab
}));

import { handleQueryCommand } from "../src/handlers/query-command.js";
import { handleSummaryCommand } from "../src/handlers/summary-command.js";
import { handleTextCommand } from "../src/handlers/text-command.js";

describe("command handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("activates and uses the requested tab for query commands", async () => {
    resolveCommandTab.mockResolvedValue({
      tab: {
        id: 42
      }
    });
    querySelectorInTab.mockResolvedValue({
      found: true
    });

    const result = await handleQueryCommand({
      kind: "command",
      requestId: "req-query",
      command: "query",
      payload: {
        selector: "#search",
        tabId: 42
      }
    });

    expect(resolveCommandTab).toHaveBeenCalledWith(42);
    expect(querySelectorInTab).toHaveBeenCalledWith(42, "#search");
    expect(result).toMatchObject({
      ok: true
    });
  });

  it("falls back to the active tab when summary has no tabId", async () => {
    resolveCommandTab.mockResolvedValue({
      tab: {
        id: 7
      }
    });
    summarizePageInTab.mockResolvedValue({
      title: "Demo"
    });

    const result = await handleSummaryCommand({
      kind: "command",
      requestId: "req-summary",
      command: "summary",
      payload: {}
    });

    expect(resolveCommandTab).toHaveBeenCalledWith(undefined);
    expect(summarizePageInTab).toHaveBeenCalledWith(7);
    expect(result).toMatchObject({
      ok: true
    });
  });

  it("returns the adapter error when the requested text tab is missing", async () => {
    resolveCommandTab.mockResolvedValue({
      tab: null,
      error: "tab not found: 99"
    });

    const result = await handleTextCommand({
      kind: "command",
      requestId: "req-text",
      command: "text",
      payload: {
        selector: "#content",
        tabId: 99
      }
    });

    expect(resolveCommandTab).toHaveBeenCalledWith(99);
    expect(textContentInTab).not.toHaveBeenCalled();
    expect(result).toEqual({
      kind: "result",
      requestId: "req-text",
      ok: false,
      error: "tab not found: 99"
    });
  });
});
