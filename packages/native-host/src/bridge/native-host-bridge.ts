import { connect, type Socket } from "node:net";
import { createReconnectController } from "./reconnect.js";
import { createOutboundQueue } from "./outbound-queue.js";
import { createSocketLineBuffer } from "./socket-buffer.js";
import { createNativeMessageReader } from "../protocol/frame-reader.js";
import { encodeNativeMessage } from "../protocol/encode-native-message.js";
import type { NativeHostBridgeOptions, NativeHostSocket } from "../types/native-host.js";

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
  const reconnect = createReconnectController(scheduleRetry, clearScheduledRetry);
  const outboundQueue = createOutboundQueue();
  const socketBuffer = createSocketLineBuffer((message) => {
    stdout.write(encodeNativeMessage(JSON.parse(message)));
  });
  const messageReader = createNativeMessageReader((message) => {
    sendToService(`${JSON.stringify(message)}\n`);
  });

  connectSocket();

  stdin.on("data", (chunk: Buffer) => {
    messageReader.push(chunk);
  });

  function connectSocket() {
    socket = connectToService(port, "127.0.0.1");
    connected = false;
    socket.setEncoding("utf8");
    socket.on("connect", () => {
      connected = true;
      reconnect.clear();
      outboundQueue.flush((payload) => {
        socket?.write(payload);
      });
    });
    socket.on("data", (chunk: string) => {
      socketBuffer.push(chunk);
    });
    socket.on("error", () => {
      connected = false;
      reconnect.schedule(connectSocket);
    });
    socket.on("close", () => {
      connected = false;
      reconnect.schedule(connectSocket);
    });
  }

  function sendToService(payload: string) {
    if (!socket || !connected) {
      outboundQueue.enqueue(payload);
      return;
    }

    socket.write(payload);
  }
}
