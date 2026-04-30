import type { CommandMessage, ResultMessage } from "@autobrowser/shared";
import { handleClickMapFinishCommand, handleClickMapStartCommand } from "./click-command.js";
import { handleCloseCommand } from "./close-command.js";
import { handleOpenCommand } from "./open-command.js";
import { handleQueryCommand } from "./query-command.js";
import { handleSearchFromPointCommand } from "./search-from-point-command.js";
import { handleRectCommand } from "./rect-command.js";
import { handleSearchCommand } from "./search-command.js";
import { handleScrollCommand } from "./scroll-command.js";
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

  if (message.command === "search") {
    return await handleSearchCommand(message);
  }

  if (message.command === "searchFromPoint") {
    return await handleSearchFromPointCommand(message);
  }

  if (message.command === "summary") {
    return await handleSummaryCommand(message);
  }

  if (message.command === "text") {
    return await handleTextCommand(message);
  }

  if (message.command === "rect") {
    return await handleRectCommand(message);
  }

  if (message.command === "scroll") {
    return await handleScrollCommand(message);
  }

  if (message.command === "clickMapStart") {
    return await handleClickMapStartCommand(message);
  }

  if (message.command === "clickMapFinish") {
    return await handleClickMapFinishCommand(message);
  }

  return null;
}
