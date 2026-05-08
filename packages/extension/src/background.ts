import type { CommandMessage } from "@autobrowser/shared";
import { handleCommand } from "./handlers/handle-command.js";
import { sendResult } from "./messaging/send-result.js";
import {
  handleMouseTrajectoryApiRequest,
  type MouseTrajectoryApiRequest
} from "./runtime/mouse-trajectory-api.js";
import { connectNativePort } from "./runtime/native-port.js";
import { scheduleReconnect } from "./runtime/reconnect.js";

let port: chrome.runtime.Port | null = null;

connect();
attachRuntimeMessageHandler();

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

function attachRuntimeMessageHandler() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isMouseTrajectoryApiRequest(message)) {
      return;
    }

    void handleMouseTrajectoryApiRequest(message).then(
      (response) => sendResponse(response),
      (error) => sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "service request failed"
      })
    );

    return true;
  });
}

function isMouseTrajectoryApiRequest(value: unknown): value is MouseTrajectoryApiRequest {
  return !!value && typeof value === "object" && "kind" in value && value.kind === "mouseTrajectoryApi";
}
