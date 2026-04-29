import type {
  CommandMessage,
  ResultMessage,
  ClickMapFinishResultPayload,
  ClickMapStartResultPayload
} from "@autobrowser/shared";
import { finishClickMappingInTab, startClickMappingInTab } from "../adapters/scripting.js";
import { resolveCommandTab } from "../adapters/tabs.js";

export async function handleClickMapStartCommand(
  message: CommandMessage<"clickMapStart">
): Promise<ResultMessage<ClickMapStartResultPayload>> {
  const { tab, error } = await resolveCommandTab(message.payload.tabId);
  if (!tab?.id) {
    return {
      kind: "result",
      requestId: message.requestId,
      ok: false,
      error: error ?? "no active tab"
    };
  }

  const payload = await startClickMappingInTab(tab.id);

  return {
    kind: "result",
    requestId: message.requestId,
    ok: true,
    payload: {
      tabId: tab.id,
      ...payload
    }
  };
}

export async function handleClickMapFinishCommand(
  message: CommandMessage<"clickMapFinish">
): Promise<ResultMessage<ClickMapFinishResultPayload>> {
  const { tab, error } = await resolveCommandTab(message.payload.tabId);
  if (!tab?.id) {
    return {
      kind: "result",
      requestId: message.requestId,
      ok: false,
      error: error ?? "no active tab"
    };
  }

  const payload = await finishClickMappingInTab(tab.id);

  return {
    kind: "result",
    requestId: message.requestId,
    ok: true,
    payload: {
      tabId: tab.id,
      ...payload
    }
  };
}
