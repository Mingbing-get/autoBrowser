import type { CommandMessage, ResultMessage } from "@autobrowser/shared";

const hostName = "com.autobrowser.host";
let port: chrome.runtime.Port | null = null;

connect();

function connect() {
  try {
    port = chrome.runtime.connectNative(hostName);
    port.onMessage.addListener((message) => {
      void handleNativeMessage(message as CommandMessage);
    });
    port.onDisconnect.addListener(() => {
      const disconnectMessage = chrome.runtime.lastError?.message;
      if (disconnectMessage) {
        console.warn("Native host disconnected:", disconnectMessage);
      }
      port = null;
      setTimeout(connect, 1000);
    });
  } catch (error) {
    console.error("Failed to connect native host", error);
  }
}

async function handleNativeMessage(message: CommandMessage) {
  if (message.kind !== "command") {
    return;
  }

  if (message.command === "open") {
    const tab = await chrome.tabs.create({ url: message.payload.url });
    sendResult({
      kind: "result",
      requestId: message.requestId,
      ok: true,
      payload: {
        tabId: tab.id ?? null,
        url: tab.url ?? message.payload.url
      }
    });
    return;
  }

  if (message.command === "query") {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) {
      sendResult({
        kind: "result",
        requestId: message.requestId,
        ok: false,
        error: "no active tab"
      });
      return;
    }

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (selector: string) => {
        const element = document.querySelector(selector);
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
      args: [message.payload.selector]
    });

    sendResult({
      kind: "result",
      requestId: message.requestId,
      ok: true,
      payload: result?.result ?? { found: false }
    });
  }
}

function sendResult(message: ResultMessage) {
  port?.postMessage(message);
}
