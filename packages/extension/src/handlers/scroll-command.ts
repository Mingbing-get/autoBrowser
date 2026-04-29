import type { CommandMessage, ResultMessage } from "@autobrowser/shared";
import { resolveCommandTab } from "../adapters/tabs.js";

export async function handleScrollCommand(
  message: CommandMessage<"scroll">
): Promise<ResultMessage<{ tabId: number }>> {
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
    payload: {
      tabId: tab.id
    }
  };
}
