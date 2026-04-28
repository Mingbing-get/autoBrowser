import { beforeEach, describe, expect, it, vi } from "vitest";
import { waitForTabSettled } from "../src/adapters/tabs.js";

type UpdatedListener = (
  tabId: number,
  changeInfo: { status?: "loading" | "complete" },
  tab: chrome.tabs.Tab
) => void;

type RequestListener = (details: { tabId: number; requestId: string }) => void;

describe("waitForTabSettled", () => {
  let updatedListeners: UpdatedListener[];
  let beforeRequestListeners: RequestListener[];
  let completedListeners: RequestListener[];
  let errorListeners: RequestListener[];
  let currentTab: chrome.tabs.Tab;

  beforeEach(() => {
    vi.useFakeTimers();

    updatedListeners = [];
    beforeRequestListeners = [];
    completedListeners = [];
    errorListeners = [];
    currentTab = {
      id: 7,
      status: "loading",
      url: "https://example.com"
    };

    globalThis.chrome = {
      tabs: {
        async create() {
          return currentTab;
        },
        async get() {
          return currentTab;
        },
        async query() {
          return [currentTab];
        },
        onUpdated: {
          addListener(listener) {
            updatedListeners.push(listener);
          },
          removeListener(listener) {
            updatedListeners = updatedListeners.filter((entry) => entry !== listener);
          }
        }
      },
      webRequest: {
        onBeforeRequest: {
          addListener(listener) {
            beforeRequestListeners.push(listener);
          },
          removeListener(listener) {
            beforeRequestListeners = beforeRequestListeners.filter((entry) => entry !== listener);
          }
        },
        onCompleted: {
          addListener(listener) {
            completedListeners.push(listener);
          },
          removeListener(listener) {
            completedListeners = completedListeners.filter((entry) => entry !== listener);
          }
        },
        onErrorOccurred: {
          addListener(listener) {
            errorListeners.push(listener);
          },
          removeListener(listener) {
            errorListeners = errorListeners.filter((entry) => entry !== listener);
          }
        }
      }
    } as typeof chrome;
  });

  it("waits for request activity to go idle after the tab reports complete", async () => {
    const pending = waitForTabSettled(7, {
      settleTimeoutMs: 4000,
      networkIdleMs: 500
    });
    await Promise.resolve();

    currentTab = {
      ...currentTab,
      status: "complete"
    };
    updatedListeners[0]?.(7, { status: "complete" }, currentTab);
    await Promise.resolve();
    beforeRequestListeners[0]?.({ tabId: 7, requestId: "req-1" });
    await vi.advanceTimersByTimeAsync(499);

    let resolved = false;
    void pending.then(() => {
      resolved = true;
    });
    await Promise.resolve();

    expect(resolved).toBe(false);

    completedListeners[0]?.({ tabId: 7, requestId: "req-1" });
    await vi.advanceTimersByTimeAsync(499);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual(currentTab);
  });

  it("returns when the post-load settle timeout elapses", async () => {
    const pending = waitForTabSettled(7, {
      settleTimeoutMs: 4000,
      networkIdleMs: 500
    });
    await Promise.resolve();

    currentTab = {
      ...currentTab,
      status: "complete"
    };
    updatedListeners[0]?.(7, { status: "complete" }, currentTab);
    await Promise.resolve();
    beforeRequestListeners[0]?.({ tabId: 7, requestId: "req-2" });

    await vi.advanceTimersByTimeAsync(4000);
    await expect(pending).resolves.toEqual(currentTab);
  });
});
