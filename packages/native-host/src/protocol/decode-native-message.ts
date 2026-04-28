export function decodeNativeMessage(buffer: Buffer): unknown {
  const length = buffer.readUInt32LE(0);
  const body = buffer.subarray(4, 4 + length);
  return JSON.parse(body.toString("utf8"));
}
