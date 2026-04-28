import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createServer as createNetServer, Socket } from "node:net";
import {
  createCommandMessage,
  type AutoBrowserCommand,
  type BrowserTransport,
  type CommandPayloadMap,
  isResultMessage,
  type ResultMessage
} from "@autobrowser/shared";

export interface DispatchFailure {
  ok: false;
  error: string;
}

export interface DispatchSuccess<TPayload = unknown> {
  ok: true;
  payload: TPayload;
}

export type DispatchResult<TPayload = unknown> = DispatchSuccess<TPayload> | DispatchFailure;

type PendingRequest = {
  resolve: (result: DispatchResult) => void;
};

export function createAutoBrowserService() {
  let transport: BrowserTransport | null = null;
  const pending = new Map<string, PendingRequest>();
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

      const entry = pending.get(message.requestId);
      if (!entry) {
        return;
      }

      pending.delete(message.requestId);
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

export interface ServiceServerOptions {
  port?: number;
}

export function createHttpApiServer(
  service: ReturnType<typeof createAutoBrowserService>,
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

export interface BridgeServerOptions {
  port?: number;
}

export function createBridgeServer(
  service: ReturnType<typeof createAutoBrowserService>,
  options: BridgeServerOptions = {}
) {
  let activeSocket: Socket | null = null;
  let buffer = "";

  const server = createNetServer((socket) => {
    activeSocket = socket;
    service.attachTransport({
      send(message) {
        socket.write(`${JSON.stringify(message)}\n`);
      }
    });

    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      const messages = buffer.split("\n");
      buffer = messages.pop() ?? "";

      for (const message of messages) {
        if (!message.trim()) {
          continue;
        }
        service.handleIncomingMessage(JSON.parse(message));
      }
    });

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

async function handleRequest(
  service: ReturnType<typeof createAutoBrowserService>,
  request: IncomingMessage,
  response: ServerResponse
) {
  if (request.method === "GET" && request.url === "/health") {
    writeJson(response, 200, {
      ok: true,
      ...service.getStatus()
    });
    return;
  }

  if (request.method === "POST" && request.url === "/commands/open") {
    const body = await readJsonBody<CommandPayloadMap["open"]>(request);
    const result = await service.dispatchCommand("open", body);
    writeJson(response, result.ok ? 200 : 503, result);
    return;
  }

  if (request.method === "POST" && request.url === "/commands/query") {
    const body = await readJsonBody<CommandPayloadMap["query"]>(request);
    const result = await service.dispatchCommand("query", body);
    writeJson(response, result.ok ? 200 : 503, result);
    return;
  }

  writeJson(response, 404, { ok: false, error: "not found" });
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

function writeJson(response: ServerResponse, statusCode: number, payload: DispatchResult | ResultMessage | { ok: boolean; error?: string }) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(payload));
}
