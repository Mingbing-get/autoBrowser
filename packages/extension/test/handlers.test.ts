import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  resolveCommandTab,
  listTabs,
  querySelectorInTab,
  summarizePageInTab,
  textContentInTab,
  closeTab
} = vi.hoisted(() => ({
  resolveCommandTab: vi.fn(),
  listTabs: vi.fn(),
  querySelectorInTab: vi.fn(),
  summarizePageInTab: vi.fn(),
  textContentInTab: vi.fn(),
  closeTab: vi.fn()
}));

vi.mock("../src/adapters/tabs.js", () => ({
  resolveCommandTab,
  listTabs,
  closeTab
}));

vi.mock("../src/adapters/scripting.js", () => ({
  querySelectorInTab,
  summarizePageInTab,
  textContentInTab
}));

import { handleQueryCommand } from "../src/handlers/query-command.js";
import { handleSummaryCommand } from "../src/handlers/summary-command.js";
import { handleTextCommand } from "../src/handlers/text-command.js";
import { handleCloseCommand } from "../src/handlers/close-command.js";
import { handleTabsCommand } from "../src/handlers/tabs-command.js";

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

  it("closes the requested tab when close receives a tabId", async () => {
    resolveCommandTab.mockResolvedValue({
      tab: {
        id: 23
      }
    });
    closeTab.mockResolvedValue(undefined);

    const result = await handleCloseCommand({
      kind: "command",
      requestId: "req-close",
      command: "close",
      payload: {
        tabId: 23
      }
    });

    expect(resolveCommandTab).toHaveBeenCalledWith(23);
    expect(closeTab).toHaveBeenCalledWith(23);
    expect(result).toEqual({
      kind: "result",
      requestId: "req-close",
      ok: true,
      payload: {
        tabId: 23
      }
    });
  });

  it("returns an error when close cannot resolve the active tab", async () => {
    resolveCommandTab.mockResolvedValue({
      tab: null,
      error: "no active tab"
    });

    const result = await handleCloseCommand({
      kind: "command",
      requestId: "req-close-active",
      command: "close",
      payload: {}
    });

    expect(resolveCommandTab).toHaveBeenCalledWith(undefined);
    expect(closeTab).not.toHaveBeenCalled();
    expect(result).toEqual({
      kind: "result",
      requestId: "req-close-active",
      ok: false,
      error: "no active tab"
    });
  });

  it("returns all tabs with active state for tabs commands", async () => {
    listTabs.mockResolvedValue([
      {
        tabId: 3,
        url: "https://example.com",
        title: "Example",
        active: false
      },
      {
        tabId: 4,
        url: "https://openai.com",
        title: "OpenAI",
        active: true
      }
    ]);

    const result = await handleTabsCommand({
      kind: "command",
      requestId: "req-tabs",
      command: "tabs",
      payload: {}
    });

    expect(listTabs).toHaveBeenCalledOnce();
    expect(result).toEqual({
      kind: "result",
      requestId: "req-tabs",
      ok: true,
      payload: [
        {
          tabId: 3,
          url: "https://example.com",
          title: "Example",
          active: false
        },
        {
          tabId: 4,
          url: "https://openai.com",
          title: "OpenAI",
          active: true
        }
      ]
    });
  });
});
