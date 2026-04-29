import type {
  BrowserTabPayload,
  ClickCommandPayload,
  ClickCommandResultPayload,
  ClickMapFinishResultPayload,
  ClickMapStartResultPayload,
  CommandPayloadMap,
  DomRectPayload
} from "@autobrowser/shared";
import { createNativeClickExecutor } from "../click/native-click-executor.js";
import type { CoordinateMapping, Point } from "../click/types.js";
import { createCommandDispatcher } from "../dispatch/command-dispatcher.js";
import type { AutoBrowserService, AutoBrowserServiceOptions, DispatchResult } from "../types/service.js";

export function createAutoBrowserService(
  options: AutoBrowserServiceOptions = {}
): AutoBrowserService {
  const dispatcher = createCommandDispatcher();
  const clickController = options.clickController ?? createNativeClickExecutor();

  return {
    attachTransport(nextTransport) {
      dispatcher.attachTransport(nextTransport);
    },
    detachTransport() {
      dispatcher.detachTransport();
    },
    getStatus() {
      return dispatcher.getStatus();
    },
    async dispatchCommand(command, payload) {
      if (command === "click") {
        return await dispatchClickCommand(
          payload as ClickCommandPayload,
          (nextCommand, nextPayload) => dispatcher.dispatchCommand(nextCommand, nextPayload),
          clickController
        );
      }

      return await dispatcher.dispatchCommand(command, payload);
    },
    handleIncomingMessage(message) {
      dispatcher.handleIncomingMessage(message);
    }
  };
}

async function dispatchClickCommand(
  payload: ClickCommandPayload,
  dispatchBrowserCommand: <T extends keyof CommandPayloadMap>(
    command: T,
    nextPayload: CommandPayloadMap[T]
  ) => Promise<DispatchResult>,
  clickController: AutoBrowserServiceOptions["clickController"]
): Promise<DispatchResult<ClickCommandResultPayload>> {
  const tabId = await resolveClickTabId(payload.tabId, dispatchBrowserCommand);
  if (!tabId.ok) {
    return tabId;
  }

  await clickController?.focusBrowserWindow(tabId.payload);

  let mapping = clickController?.getMapping(tabId.payload);

  if (!mapping) {
    const start = await dispatchBrowserCommand("clickMapStart", {
      tabId: tabId.payload
    });
    if (!start.ok) {
      return start;
    }

    const startPayload = start.payload as ClickMapStartResultPayload;
    const calibrationBrowserPoints = pickCalibrationPoints(startPayload.rect);
    const calibrationScreenPoints = calibrationBrowserPoints.map((point) =>
      estimateViewportScreenPoint(point, startPayload.window)
    );

    for (const point of calibrationScreenPoints) {
      await clickController?.clickAtScreenPoint(point);
    }

    const finish = await dispatchBrowserCommand("clickMapFinish", {
      tabId: tabId.payload
    });
    if (!finish.ok) {
      return finish;
    }

    const finishPayload = finish.payload as ClickMapFinishResultPayload;
    if (finishPayload.points.length < 2) {
      return {
        ok: false,
        error: "click mapping did not capture enough points"
      };
    }

    mapping = deriveCoordinateMapping(finishPayload.points, calibrationScreenPoints);
    clickController?.setMapping(tabId.payload, mapping);
  }

  const selectorResult = await dispatchBrowserCommand("selector", {
    selector: payload.selector,
    tabId: tabId.payload
  });
  if (!selectorResult.ok) {
    return selectorResult;
  }

  const domRect = selectorResult.payload as DomRectPayload;
  if (!domRect.found || !domRect.rect) {
    return {
      ok: false,
      error: `selector not found: ${payload.selector}`
    };
  }

  const browserTarget = pickElementTargetPoint(domRect.rect);
  const screenTarget = applyCoordinateMapping(mapping, browserTarget);
  await clickController?.clickAtScreenPoint(screenTarget);

  return {
    ok: true,
    payload: {
      clicked: true,
      tabId: tabId.payload
    }
  };
}

async function resolveClickTabId(
  tabId: number | undefined,
  dispatchBrowserCommand: <T extends keyof CommandPayloadMap>(
    command: T,
    nextPayload: CommandPayloadMap[T]
  ) => Promise<DispatchResult>
): Promise<DispatchResult<number>> {
  if (typeof tabId === "number") {
    return {
      ok: true,
      payload: tabId
    };
  }

  const tabs = await dispatchBrowserCommand("tabs", {});
  if (!tabs.ok) {
    return tabs as DispatchResult<number>;
  }

  const activeTab = (tabs.payload as BrowserTabPayload[]).find((tab) => tab.active);
  if (!activeTab) {
    return {
      ok: false,
      error: "no active tab"
    };
  }

  return {
    ok: true,
    payload: activeTab.tabId
  };
}

function pickCalibrationPoints(rect: ClickMapStartResultPayload["rect"]): Point[] {
  return [
    {
      x: rect.left + rect.width * 0.25,
      y: rect.top + rect.height * 0.3
    },
    {
      x: rect.left + rect.width * 0.75,
      y: rect.top + rect.height * 0.7
    }
  ];
}

function estimateViewportScreenPoint(
  point: Point,
  windowMetrics: ClickMapStartResultPayload["window"]
): Point {
  const horizontalInset = Math.max(0, (windowMetrics.outerWidth - windowMetrics.innerWidth) / 2);
  const verticalInset = Math.max(0, windowMetrics.outerHeight - windowMetrics.innerHeight - horizontalInset);

  return {
    x: windowMetrics.screenLeft + horizontalInset + point.x,
    y: windowMetrics.screenTop + verticalInset + point.y
  };
}

function deriveCoordinateMapping(browserPoints: Point[], screenPoints: Point[]): CoordinateMapping {
  const [browserA, browserB] = browserPoints;
  const [screenA, screenB] = screenPoints;
  const deltaBrowserX = browserB.x - browserA.x || 1;
  const deltaBrowserY = browserB.y - browserA.y || 1;
  const scaleX = (screenB.x - screenA.x) / deltaBrowserX;
  const scaleY = (screenB.y - screenA.y) / deltaBrowserY;

  return {
    scaleX,
    scaleY,
    offsetX: screenA.x - browserA.x * scaleX,
    offsetY: screenA.y - browserA.y * scaleY
  };
}

function pickElementTargetPoint(rect: NonNullable<DomRectPayload["rect"]>): Point {
  return {
    x: rect.left + rect.width * 0.52,
    y: rect.top + rect.height * 0.48
  };
}

function applyCoordinateMapping(mapping: CoordinateMapping, point: Point): Point {
  return {
    x: point.x * mapping.scaleX + mapping.offsetX,
    y: point.y * mapping.scaleY + mapping.offsetY
  };
}
