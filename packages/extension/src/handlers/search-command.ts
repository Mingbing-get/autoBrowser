import type { CommandMessage, ResultMessage } from "@autobrowser/shared";
import { searchTextInTab } from "../adapters/scripting.js";
import { resolveCommandTab } from "../adapters/tabs.js";

export async function handleSearchCommand(
  message: CommandMessage<"search">
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

  return {
    kind: "result",
    requestId: message.requestId,
    ok: true,
    payload: await searchTextInTab(tab.id, message.payload.text)
  };
}
