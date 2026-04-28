import {
  createCommandMessage,
  isResultMessage,
  type AutoBrowserCommand,
  type BrowserTransport,
  type CommandPayloadMap
} from "@autobrowser/shared";
import { createPendingRequestStore } from "./pending-requests.js";
import type { DispatchResult } from "../types/service.js";

export function createCommandDispatcher() {
  let transport: BrowserTransport | null = null;
  const pending = createPendingRequestStore();
  let nextRequestId = 1;

  return {
    attachTransport(nextTransport: BrowserTransport) {
      transport = nextTransport;
    },
    detachTransport() {
      transport = null;
    },
    getStatus() {
      return {
        connected: transport !== null,
        pendingRequests: pending.size
      };
    },
    async dispatchCommand<T extends AutoBrowserCommand>(
      command: T,
      payload: CommandPayloadMap[T]
    ): Promise<DispatchResult> {
      if (!transport) {
        return {
          ok: false,
          error: "browser extension not connected"
        };
      }

      const requestId = `req_${nextRequestId++}`;

      return await new Promise<DispatchResult>((resolve) => {
        pending.set(requestId, { resolve });
        transport?.send(createCommandMessage(requestId, command, payload));
      });
    },
    handleIncomingMessage(message: unknown) {
      if (!isResultMessage(message)) {
        return;
      }

      const entry = pending.take(message.requestId);
      if (!entry) {
        return;
      }

      if (message.ok) {
        entry.resolve({
          ok: true,
          payload: message.payload
        });
        return;
      }

      entry.resolve({
        ok: false,
        error: message.error ?? "unknown error"
      });
    }
  };
}
