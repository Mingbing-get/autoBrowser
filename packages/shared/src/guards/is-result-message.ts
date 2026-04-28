import { isRecord } from "./is-record.js";
import type { ResultMessage } from "../types/protocol.js";

export function isResultMessage(value: unknown): value is ResultMessage {
  return (
    isRecord(value) &&
    value.kind === "result" &&
    typeof value.requestId === "string" &&
    typeof value.ok === "boolean"
  );
}
