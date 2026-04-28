import type { CommandMessage } from "@autobrowser/shared";
import { handleCommand } from "./handlers/handle-command.js";
import { sendResult } from "./messaging/send-result.js";
import { connectNativePort } from "./runtime/native-port.js";
import { scheduleReconnect } from "./runtime/reconnect.js";

let port: chrome.runtime.Port | null = null;

connect();

function connect() {
  try {
    port = connectNativePort(() => {
      const disconnectMessage = chrome.runtime.lastError?.message;
      if (disconnectMessage) {
        console.warn("Native host disconnected:", disconnectMessage);
      }
      port = null;
      scheduleReconnect(connect);
    });

    port.onMessage.addListener((message) => {
      void handleNativeMessage(message as CommandMessage);
    });
  } catch (error) {
    console.error("Failed to connect native host", error);
  }
}

async function handleNativeMessage(message: CommandMessage) {
  const result = await handleCommand(message);
  if (result) {
    sendResult(port, result);
  }
}
