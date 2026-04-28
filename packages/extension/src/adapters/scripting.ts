export async function querySelectorInTab(tabId: number, selector: string) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (nextSelector: string) => {
      const element = document.querySelector(nextSelector);
      if (!element) {
        return {
          found: false
        };
      }

      return {
        found: true,
        text: element.textContent ?? "",
        html: element.outerHTML
      };
    },
    args: [selector]
  });

  return result?.result ?? { found: false };
}
