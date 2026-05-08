import { isRecord } from "./is-record.js";
import type { CommandMessage } from "../types/protocol.js";

export function isCommandMessage(value: unknown): value is CommandMessage {
  return (
    isRecord(value) &&
    value.kind === "command" &&
    typeof value.requestId === "string" &&
    ((value.command === "open" ||
      value.command === "close" ||
      value.command === "tabs" ||
      value.command === "query" ||
      value.command === "summary" ||
      value.command === "text" ||
      value.command === "rect" ||
      value.command === "click" ||
      value.command === "hover" ||
      value.command === "drag" ||
      value.command === "clickObserveStart" ||
      value.command === "clickObserveFinish" ||
      value.command === "scroll" ||
      value.command === "input" ||
      value.command === "upload" ||
      value.command === "mouseTrajectoryList" ||
      value.command === "mouseTrajectoryCreate" ||
      value.command === "mouseTrajectoryDelete" ||
      value.command === "flow" ||
      value.command === "clickMapStart" ||
      value.command === "clickMapFinish")) &&
    isRecord(value.payload)
  );
}
