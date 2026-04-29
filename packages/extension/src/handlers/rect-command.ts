import type { CommandMessage, ResultMessage } from "@autobrowser/shared";
import { getElementRectInTab } from "../adapters/scripting.js";
import { resolveCommandTab } from "../adapters/tabs.js";

export async function handleRectCommand(
  message: CommandMessage<"rect">
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
    payload: await getElementRectInTab(tab.id, message.payload.selector)
  };
}
