import type { AutoBrowserCommand, CommandMessage, CommandPayloadMap } from "../types/protocol.js";

export function createCommandMessage<T extends AutoBrowserCommand>(
  requestId: string,
  command: T,
  payload: CommandPayloadMap[T]
): CommandMessage<T> {
  return {
    kind: "command",
    requestId,
    command,
    payload
  } as CommandMessage<T>;
}
