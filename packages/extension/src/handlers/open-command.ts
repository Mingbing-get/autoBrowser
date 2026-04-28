import type { CommandMessage, ResultMessage } from "@autobrowser/shared";
import { summarizePageInTab } from "../adapters/scripting.js";
import { createTab, waitForTabSettled } from "../adapters/tabs.js";

export async function handleOpenCommand(
  message: CommandMessage<"open">
): Promise<ResultMessage> {
  const tab = await createTab(message.payload.url);
  const tabId = tab.id ?? null;

  if (!tabId) {
    return {
      kind: "result",
      requestId: message.requestId,
      ok: true,
      payload: {
        tabId: null,
        url: tab.url ?? message.payload.url,
        summary: null
      }
    };
  }

  const loadedTab = await waitForTabSettled(tabId, {
    settleTimeoutMs: 4000
  });
  const summary = await summarizePageInTab(tabId);

  return {
    kind: "result",
    requestId: message.requestId,
    ok: true,
    payload: {
      tabId,
      url: loadedTab.url ?? tab.url ?? message.payload.url,
      summary
    }
  };
}
