import { createServer } from "node:http";
import { handleRequest } from "./routes.js";
import type { AutoBrowserService } from "../types/service.js";

export interface ServiceServerOptions {
  port?: number;
}

export function createHttpApiServer(
  service: AutoBrowserService,
  options: ServiceServerOptions = {}
) {
  const server = createServer(async (request, response) => {
    await handleRequest(service, request, response);
  });

  return {
    listen() {
      return new Promise<void>((resolve) => {
        server.listen(options.port ?? 3210, "127.0.0.1", () => resolve());
      });
    },
    close() {
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
