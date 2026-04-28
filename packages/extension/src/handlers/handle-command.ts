import type { CommandMessage, ResultMessage } from "@autobrowser/shared";
import { handleOpenCommand } from "./open-command.js";
import { handleQueryCommand } from "./query-command.js";

export async function handleCommand(message: CommandMessage): Promise<ResultMessage | null> {
  if (message.kind !== "command") {
    return null;
  }

  if (message.command === "open") {
    return await handleOpenCommand(message);
  }

  if (message.command === "query") {
    return await handleQueryCommand(message);
  }

  return null;
}
