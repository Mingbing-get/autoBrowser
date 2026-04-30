import type {
  ClickObserveFinishResultPayload,
  ClickObserveStartResultPayload,
  CommandMessage,
  ResultMessage
} from "@autobrowser/shared";
import {
  finishClickObservationInTab,
  startClickObservationInTab
} from "../adapters/scripting.js";
import { resolveCommandTab } from "../adapters/tabs.js";

export async function handleClickObserveStartCommand(
  message: CommandMessage<"clickObserveStart">
): Promise<ResultMessage<ClickObserveStartResultPayload>> {
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
    payload: await startClickObservationInTab(tab.id, message.payload)
  };
}

export async function handleClickObserveFinishCommand(
  message: CommandMessage<"clickObserveFinish">
): Promise<ResultMessage<ClickObserveFinishResultPayload>> {
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
    payload: await finishClickObservationInTab(tab.id, message.payload)
  };
}
