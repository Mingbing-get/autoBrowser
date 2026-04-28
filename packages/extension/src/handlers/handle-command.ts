import type { CommandMessage, ResultMessage } from "@autobrowser/shared";
import { handleCloseCommand } from "./close-command.js";
import { handleOpenCommand } from "./open-command.js";
import { handleQueryCommand } from "./query-command.js";
import { handleSummaryCommand } from "./summary-command.js";
import { handleTabsCommand } from "./tabs-command.js";
import { handleTextCommand } from "./text-command.js";

export async function handleCommand(message: CommandMessage): Promise<ResultMessage | null> {
  if (message.kind !== "command") {
    return null;
  }

  if (message.command === "open") {
    return await handleOpenCommand(message);
  }

  if (message.command === "close") {
    return await handleCloseCommand(message);
  }

  if (message.command === "tabs") {
    return await handleTabsCommand(message);
  }

  if (message.command === "query") {
    return await handleQueryCommand(message);
  }

  if (message.command === "summary") {
    return await handleSummaryCommand(message);
  }

  if (message.command === "text") {
    return await handleTextCommand(message);
  }

  return null;
}
