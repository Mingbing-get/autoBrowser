import { isRecord } from "./is-record.js";
import type { CommandMessage } from "../types/protocol.js";

export function isCommandMessage(value: unknown): value is CommandMessage {
  return (
    isRecord(value) &&
    value.kind === "command" &&
    typeof value.requestId === "string" &&
    (value.command === "open" ||
      value.command === "close" ||
      value.command === "tabs" ||
      value.command === "query" ||
      value.command === "summary" ||
      value.command === "text") &&
    isRecord(value.payload)
  );
}
