export async function createTab(url: string) {
  return await chrome.tabs.create({ url });
}

export async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}
