import { createCommandDispatcher } from "../dispatch/command-dispatcher.js";
import type { AutoBrowserService } from "../types/service.js";

export function createAutoBrowserService(): AutoBrowserService {
  const dispatcher = createCommandDispatcher();

  return {
    attachTransport(nextTransport) {
      dispatcher.attachTransport(nextTransport);
    },
    detachTransport() {
      dispatcher.detachTransport();
    },
    getStatus() {
      return dispatcher.getStatus();
    },
    async dispatchCommand(command, payload) {
      return await dispatcher.dispatchCommand(command, payload);
    },
    handleIncomingMessage(message) {
      dispatcher.handleIncomingMessage(message);
    }
  };
}
