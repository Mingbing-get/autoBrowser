import type { ResultMessage } from "@autobrowser/shared";

export function sendResult(port: chrome.runtime.Port | null, message: ResultMessage) {
  port?.postMessage(message);
}
