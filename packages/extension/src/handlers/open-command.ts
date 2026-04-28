import type { CommandMessage, ResultMessage } from "@autobrowser/shared";
import { createTab } from "../adapters/tabs.js";

export async function handleOpenCommand(
  message: CommandMessage<"open">
): Promise<ResultMessage> {
  const tab = await createTab(message.payload.url);

  return {
    kind: "result",
    requestId: message.requestId,
    ok: true,
    payload: {
      tabId: tab.id ?? null,
      url: tab.url ?? message.payload.url
    }
  };
}
