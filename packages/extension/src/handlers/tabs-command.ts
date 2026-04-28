import type { CommandMessage, ResultMessage } from "@autobrowser/shared";
import { listTabs } from "../adapters/tabs.js";

export async function handleTabsCommand(
  message: CommandMessage<"tabs">
): Promise<ResultMessage> {
  return {
    kind: "result",
    requestId: message.requestId,
    ok: true,
    payload: await listTabs()
  };
}
