import type { CommandMessage, ResultMessage } from "@autobrowser/shared";
import { textContentInTab } from "../adapters/scripting.js";
import { getActiveTab } from "../adapters/tabs.js";

export async function handleTextCommand(
  message: CommandMessage<"text">
): Promise<ResultMessage> {
  const tab = await getActiveTab();
  if (!tab?.id) {
    return {
      kind: "result",
      requestId: message.requestId,
      ok: false,
      error: "no active tab"
    };
  }

  return {
    kind: "result",
    requestId: message.requestId,
    ok: true,
    payload: await textContentInTab(tab.id, message.payload.selector)
  };
}
