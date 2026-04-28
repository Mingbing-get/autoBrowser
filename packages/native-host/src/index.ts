import { connect, type Socket } from "node:net";

export interface NativeHostSocket {
  on(event: "connect", listener: () => void): this;
  on(event: "data", listener: (chunk: string) => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: "close", listener: () => void): this;
  setEncoding(encoding: BufferEncoding): void;
  write(data: string | Buffer): boolean;
  destroy(): void;
}

export interface NativeHostBridgeOptions {
  connectToService?: (port: number, host: string) => NativeHostSocket;
  stdin?: NodeJS.EventEmitter;
  stdout?: {
    write(data: string | Buffer): void;
  };
  scheduleRetry?: (callback: () => void, delayMs: number) => unknown;
  clearScheduledRetry?: (handle: unknown) => void;
}

export function encodeNativeMessage(payload: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  return Buffer.concat([header, body]);
}

export function decodeNativeMessage(buffer: Buffer): unknown {
  const length = buffer.readUInt32LE(0);
  const body = buffer.subarray(4, 4 + length);
  return JSON.parse(body.toString("utf8"));
}

export function startNativeHostBridge(
  port = 3211,
  options: NativeHostBridgeOptions = {}
) {
  const connectToService =
    options.connectToService ??
    ((nextPort: number, host: string) => connect(nextPort, host) as Socket);
  const stdin = options.stdin ?? process.stdin;
  const stdout = options.stdout ?? process.stdout;
  const scheduleRetry =
    options.scheduleRetry ?? ((callback: () => void, delayMs: number) => setTimeout(callback, delayMs));
  const clearScheduledRetry =
    options.clearScheduledRetry ?? ((handle: unknown) => clearTimeout(handle as NodeJS.Timeout));

  let socket: NativeHostSocket | null = null;
  let connected = false;
  let stdinBuffer = Buffer.alloc(0);
  let socketBuffer = "";
  let retryHandle: unknown = null;
  const outboundQueue: string[] = [];

  connectSocket();

  stdin.on("data", (chunk: Buffer) => {
    stdinBuffer = Buffer.concat([stdinBuffer, chunk]);
    while (stdinBuffer.length >= 4) {
      const bodyLength = stdinBuffer.readUInt32LE(0);
      if (stdinBuffer.length < bodyLength + 4) {
        break;
      }

      const frame = stdinBuffer.subarray(0, bodyLength + 4);
      stdinBuffer = stdinBuffer.subarray(bodyLength + 4);
      const message = decodeNativeMessage(frame);
      sendToService(`${JSON.stringify(message)}\n`);
    }
  });

  function connectSocket() {
    socket = connectToService(port, "127.0.0.1");
    connected = false;
    socket.setEncoding("utf8");
    socket.on("connect", () => {
      connected = true;
      if (retryHandle !== null) {
        clearScheduledRetry(retryHandle);
        retryHandle = null;
      }
      flushQueue();
    });
    socket.on("data", (chunk: string) => {
      socketBuffer += chunk;
      const messages = socketBuffer.split("\n");
      socketBuffer = messages.pop() ?? "";

      for (const message of messages) {
        if (!message.trim()) {
          continue;
        }
        stdout.write(encodeNativeMessage(JSON.parse(message)));
      }
    });
    socket.on("error", () => {
      connected = false;
      scheduleReconnect();
    });
    socket.on("close", () => {
      connected = false;
      scheduleReconnect();
    });
  }

  function scheduleReconnect() {
    if (retryHandle !== null) {
      return;
    }
    retryHandle = scheduleRetry(() => {
      retryHandle = null;
      connectSocket();
    }, 1000);
  }

  function sendToService(payload: string) {
    if (!socket || !connected) {
      outboundQueue.push(payload);
      return;
    }
    socket.write(payload);
  }

  function flushQueue() {
    if (!socket || !connected) {
      return;
    }
    while (outboundQueue.length > 0) {
      const nextPayload = outboundQueue.shift();
      if (nextPayload) {
        socket.write(nextPayload);
      }
    }
  }
}
