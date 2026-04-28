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

export async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}
