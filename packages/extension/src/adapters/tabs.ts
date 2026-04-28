export async function createTab(url: string) {
  return await chrome.tabs.create({ url });
}

export async function waitForTabComplete(tabId: number, timeoutMs = 15000) {
  const existing = await chrome.tabs.get(tabId);
  if (existing.status === "complete") {
    return existing;
  }

  return await new Promise<typeof existing>((resolve) => {
    const timeout = globalThis.setTimeout(async () => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(await chrome.tabs.get(tabId));
    }, timeoutMs);

    function listener(
      updatedTabId: number,
      changeInfo: { status?: "loading" | "complete" },
      tab: typeof existing
    ) {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") {
        return;
      }

      globalThis.clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(tab);
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

type WaitForTabSettledOptions = {
  loadTimeoutMs?: number;
  settleTimeoutMs?: number;
  networkIdleMs?: number;
};

export async function waitForTabSettled(
  tabId: number,
  options: WaitForTabSettledOptions = {}
) {
  const {
    loadTimeoutMs = 15000,
    settleTimeoutMs = 4000,
    networkIdleMs = 800
  } = options;

  const loadedTab = await waitForTabComplete(tabId, loadTimeoutMs);

  return await new Promise<typeof loadedTab>((resolve) => {
    let finished = false;
    let idleTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
    const activeRequests = new Set<string>();

    const finish = async () => {
      if (finished) {
        return;
      }

      finished = true;
      cleanup();
      resolve(await chrome.tabs.get(tabId));
    };

    const scheduleIdleCheck = () => {
      if (finished || activeRequests.size > 0) {
        return;
      }

      if (idleTimer) {
        globalThis.clearTimeout(idleTimer);
      }

      idleTimer = globalThis.setTimeout(() => {
        void finish();
      }, networkIdleMs);
    };

    const onBeforeRequest = (details: { tabId: number; requestId: string }) => {
      if (details.tabId !== tabId) {
        return;
      }

      activeRequests.add(details.requestId);
      if (idleTimer) {
        globalThis.clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const onRequestDone = (details: { tabId: number; requestId: string }) => {
      if (details.tabId !== tabId) {
        return;
      }

      activeRequests.delete(details.requestId);
      scheduleIdleCheck();
    };

    const cleanup = () => {
      if (idleTimer) {
        globalThis.clearTimeout(idleTimer);
        idleTimer = null;
      }

      globalThis.clearTimeout(settleTimeout);
      chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequest);
      chrome.webRequest.onCompleted.removeListener(onRequestDone);
      chrome.webRequest.onErrorOccurred.removeListener(onRequestDone);
    };

    const settleTimeout = globalThis.setTimeout(() => {
      void finish();
    }, settleTimeoutMs);

    chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, {
      urls: ["<all_urls>"]
    });
    chrome.webRequest.onCompleted.addListener(onRequestDone, {
      urls: ["<all_urls>"]
    });
    chrome.webRequest.onErrorOccurred.addListener(onRequestDone, {
      urls: ["<all_urls>"]
    });

    scheduleIdleCheck();
  });
}

export async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

export async function resolveCommandTab(tabId?: number) {
  if (typeof tabId !== "number") {
    const tab = await getActiveTab();
    return {
      tab: tab ?? null,
      error: tab?.id ? undefined : "no active tab"
    };
  }

  try {
    const existing = await chrome.tabs.get(tabId);
    if (!existing?.id) {
      return {
        tab: null,
        error: `tab not found: ${tabId}`
      };
    }

    const activated = await chrome.tabs.update(tabId, {
      active: true
    });

    return {
      tab: activated,
      error: activated?.id ? undefined : `tab not found: ${tabId}`
    };
  } catch {
    return {
      tab: null,
      error: `tab not found: ${tabId}`
    };
  }
}
