import type { CommandMessage, ResultMessage } from "@autobrowser/shared";
import { querySelectorInTab } from "../adapters/scripting.js";
import { resolveCommandTab } from "../adapters/tabs.js";

export async function handleQueryCommand(
  message: CommandMessage<"query">
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
    payload: await querySelectorInTab(tab.id, message.payload.selector)
  };
}
