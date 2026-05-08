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
import { resolveCommandTab, waitForTabSettled } from "../adapters/tabs.js";

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

  try {
    return {
      kind: "result",
      requestId: message.requestId,
      ok: true,
      payload: await startClickObservationInTab(tab.id, message.payload)
    };
  } catch (cause) {
    return {
      kind: "result",
      requestId: message.requestId,
      ok: false,
      error: cause instanceof Error ? cause.message : "clickObserveStart failed"
    };
  }
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

  try {
    if (message.payload.awaitStability !== false) {
      await waitForTabSettled(tab.id, {
        settleTimeoutMs: message.payload.observe?.maxObserveMs ?? 10000,
        networkIdleMs: message.payload.observe?.stableWindowMs ?? 1000
      });
    }

    return {
      kind: "result",
      requestId: message.requestId,
      ok: true,
      payload: await finishClickObservationInTab(tab.id, message.payload)
    };
  } catch (cause) {
    return {
      kind: "result",
      requestId: message.requestId,
      ok: false,
      error: cause instanceof Error ? cause.message : "clickObserveFinish failed"
    };
  }
}
