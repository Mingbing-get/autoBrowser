import { createServer as createNetServer, type Socket } from "node:net";
import { bindSocketSession } from "./socket-session.js";
import type { AutoBrowserService } from "../types/service.js";

export interface BridgeServerOptions {
  port?: number;
}

export function createBridgeServer(
  service: AutoBrowserService,
  options: BridgeServerOptions = {}
) {
  let activeSocket: Socket | null = null;

  const server = createNetServer((socket) => {
    activeSocket = socket;
    bindSocketSession(service, socket);

    socket.on("close", () => {
      if (activeSocket === socket) {
        activeSocket = null;
        service.detachTransport();
      }
    });
  });

  return {
    listen() {
      return new Promise<void>((resolve) => {
        server.listen(options.port ?? 3211, "127.0.0.1", () => resolve());
      });
    },
    close() {
      if (activeSocket) {
        activeSocket.destroy();
      }
      return new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  };
}
