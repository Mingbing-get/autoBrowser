import { isRecord } from "./is-record.js";
import type { CommandMessage } from "../types/protocol.js";

export function isCommandMessage(value: unknown): value is CommandMessage {
  return (
    isRecord(value) &&
    value.kind === "command" &&
    typeof value.requestId === "string" &&
    (value.command === "open" || value.command === "query") &&
    isRecord(value.payload)
  );
}
