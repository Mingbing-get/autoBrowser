import type { CommandMessage, ResultMessage } from "@autobrowser/shared";
import { closeTab, resolveCommandTab } from "../adapters/tabs.js";

export async function handleCloseCommand(
  message: CommandMessage<"close">
): Promise<ResultMessage> {
  const { tab, error } = await resolveCommandTab(message.payload.tabId);
  if (!tab?.id) {
    return {
      kind: "result",
      requestId: message.requestId,
      ok: false,
      error: error ?? "no active tab"
    };
  }

  await closeTab(tab.id);

  return {
    kind: "result",
    requestId: message.requestId,
    ok: true,
    payload: {
      tabId: tab.id
    }
  };
}
