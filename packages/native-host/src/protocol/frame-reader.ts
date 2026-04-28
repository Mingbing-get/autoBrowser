import { decodeNativeMessage } from "./decode-native-message.js";

export function createNativeMessageReader(onMessage: (message: unknown) => void) {
  let stdinBuffer = Buffer.alloc(0);

  return {
    push(chunk: Buffer) {
      stdinBuffer = Buffer.concat([stdinBuffer, chunk]);
      while (stdinBuffer.length >= 4) {
        const bodyLength = stdinBuffer.readUInt32LE(0);
        if (stdinBuffer.length < bodyLength + 4) {
          break;
        }

        const frame = stdinBuffer.subarray(0, bodyLength + 4);
        stdinBuffer = stdinBuffer.subarray(bodyLength + 4);
        onMessage(decodeNativeMessage(frame));
      }
    }
  };
}
