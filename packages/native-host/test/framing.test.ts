import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import {
  decodeNativeMessage,
  encodeNativeMessage,
  startNativeHostBridge
} from "../src/index.js";

describe("native host framing", () => {
  it("encodes and decodes a JSON message with chrome framing", () => {
    const buffer = encodeNativeMessage({
      kind: "command",
      requestId: "req_1",
      command: "open",
      payload: {
        url: "https://www.baidu.com"
      }
    });

    const decoded = decodeNativeMessage(buffer);
    expect(decoded).toEqual({
      kind: "command",
      requestId: "req_1",
      command: "open",
      payload: {
        url: "https://www.baidu.com"
      }
    });
  });

  it("retries connecting to the service instead of exiting on socket error", () => {
    const firstSocket = new FakeSocket();
    const secondSocket = new FakeSocket();
    const connectToService = vi
      .fn<() => FakeSocket>()
      .mockReturnValueOnce(firstSocket)
      .mockReturnValueOnce(secondSocket);
    const scheduledRetries: Array<() => void> = [];

    startNativeHostBridge(3211, {
      connectToService,
      stdin: new EventEmitter(),
      stdout: { write: vi.fn() },
      scheduleRetry(callback) {
        scheduledRetries.push(callback);
        return 1;
      },
      clearScheduledRetry() {}
    });

    expect(connectToService).toHaveBeenCalledTimes(1);

    firstSocket.emit("error", new Error("connect refused"));

    expect(scheduledRetries).toHaveLength(1);
    scheduledRetries[0]();
    expect(connectToService).toHaveBeenCalledTimes(2);
  });
});

class FakeSocket extends EventEmitter {
  setEncoding(_encoding: string) {}
  write(_data: string | Buffer) {
    return true;
  }
  destroy() {}
}
