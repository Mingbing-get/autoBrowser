import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  resolveCommandTab,
  waitForTabSettled,
  listTabs,
  querySelectorInTab,
  searchTextInTab,
  searchElementsFromPointInTab,
  getElementRectInTab,
  startClickMappingInTab,
  finishClickMappingInTab,
  summarizePageInTab,
  textContentInTab,
  closeTab,
  startClickObservationInTab,
  finishClickObservationInTab
} = vi.hoisted(() => ({
  resolveCommandTab: vi.fn(),
  waitForTabSettled: vi.fn(),
  listTabs: vi.fn(),
  querySelectorInTab: vi.fn(),
  searchTextInTab: vi.fn(),
  searchElementsFromPointInTab: vi.fn(),
  getElementRectInTab: vi.fn(),
  startClickMappingInTab: vi.fn(),
  finishClickMappingInTab: vi.fn(),
  summarizePageInTab: vi.fn(),
  textContentInTab: vi.fn(),
  closeTab: vi.fn(),
  startClickObservationInTab: vi.fn(),
  finishClickObservationInTab: vi.fn()
}));

vi.mock("../src/adapters/tabs.js", () => ({
  resolveCommandTab,
  waitForTabSettled,
  listTabs,
  closeTab
}));

vi.mock("../src/adapters/scripting.js", () => ({
  querySelectorInTab,
  searchTextInTab,
  searchElementsFromPointInTab,
  getElementRectInTab,
  startClickMappingInTab,
  finishClickMappingInTab,
  summarizePageInTab,
  textContentInTab,
  startClickObservationInTab,
  finishClickObservationInTab
}));

import { handleQueryCommand } from "../src/handlers/query-command.js";
import { handleSummaryCommand } from "../src/handlers/summary-command.js";
import { handleSearchCommand } from "../src/handlers/search-command.js";
import { handleTextCommand } from "../src/handlers/text-command.js";
import { handleCloseCommand } from "../src/handlers/close-command.js";
import { handleTabsCommand } from "../src/handlers/tabs-command.js";
import { handleRectCommand } from "../src/handlers/rect-command.js";
import { handleCommand } from "../src/handlers/handle-command.js";

describe("command handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    waitForTabSettled.mockResolvedValue({
      id: 0
    });
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

  it("activates and uses the requested tab for search commands", async () => {
    resolveCommandTab.mockResolvedValue({
      tab: {
        id: 64
      }
    });
    searchTextInTab.mockResolvedValue({
      found: true,
      matches: [
        {
          selector: "#search-button",
          tag: "button",
          text: "Search now",
          visible: true
        }
      ],
      meta: {
        query: "Search",
        limit: 20,
        totalMatches: 1,
        truncated: false
      }
    });

    const result = await handleSearchCommand({
      kind: "command",
      requestId: "req-search",
      command: "search",
      payload: {
        text: "Search",
        tabId: 64
      }
    });

    expect(resolveCommandTab).toHaveBeenCalledWith(64);
    expect(searchTextInTab).toHaveBeenCalledWith(64, "Search");
    expect(result).toMatchObject({
      ok: true
    });
  });

  it("activates and uses the requested tab for search-from-point commands", async () => {
    resolveCommandTab.mockResolvedValue({
      tab: {
        id: 66
      }
    });
    searchElementsFromPointInTab.mockResolvedValue({
      found: true,
      x: 120,
      y: 84,
      matches: [
        {
          level: 0,
          selector: "#search-button",
          tag: "button",
          visible: true,
          rect: {
            x: 100,
            y: 60,
            top: 60,
            left: 100,
            right: 180,
            bottom: 92,
            width: 80,
            height: 32,
            scrollWidth: 80,
            scrollHeight: 32
          }
        }
      ]
    });

    const result = await handleCommand({
      kind: "command",
      requestId: "req-search-point",
      command: "searchFromPoint",
      payload: {
        x: 120,
        y: 84,
        tabId: 66
      }
    });

    expect(resolveCommandTab).toHaveBeenCalledWith(66);
    expect(searchElementsFromPointInTab).toHaveBeenCalledWith(66, 120, 84);
    expect(result).toMatchObject({
      ok: true
    });
  });

  it("activates and uses the requested tab for clickObserveStart commands", async () => {
    resolveCommandTab.mockResolvedValue({
      tab: {
        id: 77
      }
    });
    startClickObservationInTab.mockResolvedValue({
      started: true,
      tabId: 77
    });

    const result = await handleCommand({
      kind: "command",
      requestId: "req-click-observe-start",
      command: "clickObserveStart",
      payload: {
        selector: "#open-menu",
        tabId: 77
      }
    });

    expect(resolveCommandTab).toHaveBeenCalledWith(77);
    expect(startClickObservationInTab).toHaveBeenCalledWith(
      77,
      expect.objectContaining({
        selector: "#open-menu"
      })
    );
    expect(result).toMatchObject({
      ok: true,
      payload: expect.objectContaining({
        started: true,
        tabId: 77
      })
    });
  });

  it("activates and uses the requested tab for clickObserveFinish commands", async () => {
    resolveCommandTab.mockResolvedValue({
      tab: {
        id: 77
      }
    });
    finishClickObservationInTab.mockResolvedValue({
      tabId: 77,
      observation: {
        primaryEffect: "overlay",
        regions: [],
        meta: {
          durationMs: 220,
          endedBy: "stabilized",
          networkEvents: 0,
          meaningfulMutations: 2
        }
      }
    });

    const result = await handleCommand({
      kind: "command",
      requestId: "req-click-observe-finish",
      command: "clickObserveFinish",
      payload: {
        tabId: 77,
        awaitStability: true,
        observe: {
          stableWindowMs: 240,
          maxObserveMs: 1200
        }
      }
    });

    expect(resolveCommandTab).toHaveBeenCalledWith(77);
    expect(waitForTabSettled).toHaveBeenCalledWith(77, {
      settleTimeoutMs: 1200,
      networkIdleMs: 240
    });
    expect(finishClickObservationInTab).toHaveBeenCalledWith(
      77,
      expect.objectContaining({
        awaitStability: true,
        observe: {
          stableWindowMs: 240,
          maxObserveMs: 1200
        }
      })
    );
    expect(result).toMatchObject({
      ok: true,
      payload: expect.objectContaining({
        tabId: 77
      })
    });
  });

  it("returns an error result when clickObserveFinish observation throws", async () => {
    resolveCommandTab.mockResolvedValue({
      tab: {
        id: 77
      }
    });
    finishClickObservationInTab.mockRejectedValue(new Error("observe finish failed"));

    const result = await handleCommand({
      kind: "command",
      requestId: "req-click-observe-finish-error",
      command: "clickObserveFinish",
      payload: {
        tabId: 77,
        awaitStability: true
      }
    });

    expect(resolveCommandTab).toHaveBeenCalledWith(77);
    expect(waitForTabSettled).toHaveBeenCalledWith(77, {
      settleTimeoutMs: 4000,
      networkIdleMs: 300
    });
    expect(finishClickObservationInTab).toHaveBeenCalledWith(
      77,
      expect.objectContaining({
        awaitStability: true
      })
    );
    expect(result).toEqual({
      kind: "result",
      requestId: "req-click-observe-finish-error",
      ok: false,
      error: "observe finish failed"
    });
  });

  it("skips tab settling when clickObserveFinish disables stability waiting", async () => {
    resolveCommandTab.mockResolvedValue({
      tab: {
        id: 77
      }
    });
    finishClickObservationInTab.mockResolvedValue({
      tabId: 77,
      observation: {
        primaryEffect: "no-visible-change",
        regions: [],
        meta: {
          durationMs: 0,
          endedBy: "no-change",
          networkEvents: 0,
          meaningfulMutations: 0
        }
      }
    });

    const result = await handleCommand({
      kind: "command",
      requestId: "req-click-observe-finish-no-wait",
      command: "clickObserveFinish",
      payload: {
        tabId: 77,
        awaitStability: false
      }
    });

    expect(waitForTabSettled).not.toHaveBeenCalled();
    expect(finishClickObservationInTab).toHaveBeenCalledWith(
      77,
      expect.objectContaining({
        awaitStability: false
      })
    );
    expect(result).toMatchObject({
      ok: true,
      payload: expect.objectContaining({
        tabId: 77
      })
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

  it("activates and uses the requested tab for rect commands", async () => {
    resolveCommandTab.mockResolvedValue({
      tab: {
        id: 51
      }
    });
    getElementRectInTab.mockResolvedValue({
      found: true,
      rect: {
        x: 10,
        y: 20,
        top: 20,
        left: 10,
        right: 110,
        bottom: 70,
        width: 100,
        height: 50
      }
    });

    const result = await handleRectCommand({
      kind: "command",
      requestId: "req-rect",
      command: "rect",
      payload: {
        selector: "#search",
        tabId: 51
      }
    });

    expect(resolveCommandTab).toHaveBeenCalledWith(51);
    expect(getElementRectInTab).toHaveBeenCalledWith(51, "#search");
    expect(result).toMatchObject({
      ok: true
    });
  });

  it("starts click mapping on the resolved tab", async () => {
    resolveCommandTab.mockResolvedValue({
      tab: {
        id: 61
      }
    });
    startClickMappingInTab.mockResolvedValue({
      rect: {
        left: 0,
        top: 0,
        width: 1200,
        height: 800
      },
      window: {
        screenLeft: 100,
        screenTop: 40,
        innerWidth: 1200,
        innerHeight: 800,
        outerWidth: 1216,
        outerHeight: 920,
        devicePixelRatio: 2
      },
      zoom: 1.5
    });

    const result = await handleCommand({
      kind: "command",
      requestId: "req-click-map-start",
      command: "clickMapStart",
      payload: {
        tabId: 61
      }
    });

    expect(resolveCommandTab).toHaveBeenCalledWith(61);
    expect(startClickMappingInTab).toHaveBeenCalledWith(61);
    expect(result).toEqual({
      kind: "result",
      requestId: "req-click-map-start",
      ok: true,
      payload: {
        tabId: 61,
        rect: {
          left: 0,
          top: 0,
          width: 1200,
          height: 800
        },
        window: {
          screenLeft: 100,
          screenTop: 40,
          innerWidth: 1200,
          innerHeight: 800,
          outerWidth: 1216,
          outerHeight: 920,
          devicePixelRatio: 2
        },
        zoom: 1.5
      }
    });
  });

  it("finishes click mapping on the resolved tab", async () => {
    resolveCommandTab.mockResolvedValue({
      tab: {
        id: 61
      }
    });
    finishClickMappingInTab.mockResolvedValue({
      points: [
        { x: 120, y: 180 },
        { x: 860, y: 620 }
      ]
    });

    const result = await handleCommand({
      kind: "command",
      requestId: "req-click-map-finish",
      command: "clickMapFinish",
      payload: {
        tabId: 61
      }
    });

    expect(resolveCommandTab).toHaveBeenCalledWith(61);
    expect(finishClickMappingInTab).toHaveBeenCalledWith(61);
    expect(result).toEqual({
      kind: "result",
      requestId: "req-click-map-finish",
      ok: true,
      payload: {
        tabId: 61,
        points: [
          { x: 120, y: 180 },
          { x: 860, y: 620 }
        ]
      }
    });
  });

  it("activates the requested tab for scroll commands", async () => {
    resolveCommandTab.mockResolvedValue({
      tab: {
        id: 77
      }
    });

    const result = await handleCommand({
      kind: "command",
      requestId: "req-scroll",
      command: "scroll",
      payload: {
        deltaX: 100,
        deltaY: -50,
        tabId: 77
      }
    });

    expect(resolveCommandTab).toHaveBeenCalledWith(77);
    expect(result).toEqual({
      kind: "result",
      requestId: "req-scroll",
      ok: true,
      payload: {
        tabId: 77
      }
    });
  });
});
