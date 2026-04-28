import type { Socket } from "node:net";
import type { AutoBrowserService } from "../types/service.js";
import { createLineMessageBuffer } from "./message-buffer.js";

export function bindSocketSession(service: AutoBrowserService, socket: Socket) {
  const buffer = createLineMessageBuffer();

  service.attachTransport({
    send(message) {
      socket.write(`${JSON.stringify(message)}\n`);
    }
  });

  socket.setEncoding("utf8");
  socket.on("data", (chunk: string) => {
    const messages = buffer.push(chunk);

    for (const message of messages) {
      service.handleIncomingMessage(JSON.parse(message));
    }
  });
}
