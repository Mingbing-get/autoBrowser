import type {
  BrowserTabPayload,
  ClickCommandPayload,
  ClickCommandResultPayload,
  ClickMapFinishResultPayload,
  ClickMapStartResultPayload,
  CommandPayloadMap,
  DomRectPayload,
  FlowCommandPayload,
  FlowCommandResultPayload,
  FlowStep,
  FlowStepResult,
  InputCommandPayload,
  InputCommandResultPayload,
  ScrollCommandPayload,
  ScrollCommandResultPayload,
} from '@autobrowser/shared'
import { createNativeClickExecutor } from '../click/native-click-executor.js'
import type { CoordinateMapping, Point } from '../click/types.js'
import { createCommandDispatcher } from '../dispatch/command-dispatcher.js'
import { createNativeKeyboardExecutor } from '../input/native-keyboard-executor.js'
import type { KeyboardController } from '../input/types.js'
import type { AutoBrowserService, AutoBrowserServiceOptions, DispatchResult } from '../types/service.js'

export function createAutoBrowserService(options: AutoBrowserServiceOptions = {}): AutoBrowserService {
  const dispatcher = createCommandDispatcher()
  const clickController = options.clickController ?? createNativeClickExecutor()
  const keyboardController = options.keyboardController ?? createNativeKeyboardExecutor()
  const getFlowDelayMs = options.getFlowDelayMs ?? nextFlowDelayMs
  const sleep = options.sleep ?? delay

  return {
    attachTransport(nextTransport) {
      dispatcher.attachTransport(nextTransport)
    },
    detachTransport() {
      dispatcher.detachTransport()
    },
    getStatus() {
      return dispatcher.getStatus()
    },
    async dispatchCommand(command, payload) {
      if (command === 'flow') {
        return await dispatchFlowCommand(
          payload as FlowCommandPayload,
          (nextCommand, nextPayload) => dispatcher.dispatchCommand(nextCommand, nextPayload),
          clickController,
          keyboardController,
          getFlowDelayMs,
          sleep,
        )
      }

      if (command === 'click') {
        return await dispatchClickCommand(
          payload as ClickCommandPayload,
          (nextCommand, nextPayload) => dispatcher.dispatchCommand(nextCommand, nextPayload),
          clickController,
        )
      }

      if (command === 'scroll') {
        return await dispatchScrollCommand(
          payload as ScrollCommandPayload,
          (nextCommand, nextPayload) => dispatcher.dispatchCommand(nextCommand, nextPayload),
          clickController,
          sleep,
        )
      }

      if (command === 'input') {
        return await dispatchInputCommand(
          payload as InputCommandPayload,
          (nextCommand, nextPayload) => dispatcher.dispatchCommand(nextCommand, nextPayload),
          clickController,
          keyboardController,
        )
      }

      return await dispatcher.dispatchCommand(command, payload)
    },
    handleIncomingMessage(message) {
      dispatcher.handleIncomingMessage(message)
    },
  }
}

async function dispatchFlowCommand(
  payload: FlowCommandPayload,
  dispatchBrowserCommand: <T extends keyof CommandPayloadMap>(
    command: T,
    nextPayload: CommandPayloadMap[T],
  ) => Promise<DispatchResult>,
  clickController: AutoBrowserServiceOptions['clickController'],
  keyboardController: KeyboardController,
  getFlowDelayMs: () => number,
  sleep: (ms: number) => Promise<void>,
): Promise<DispatchResult<FlowCommandResultPayload>> {
  const results: FlowStepResult[] = []

  for (let index = 0; index < payload.steps.length; index += 1) {
    const step = payload.steps[index]
    const result = await dispatchFlowStep(step, dispatchBrowserCommand, clickController, keyboardController)

    if (!result.ok) {
      results.push({
        index,
        action: step.action,
        ok: false,
        error: result.error,
      })

      return {
        ok: false,
        error: result.error,
        payload: {
          failedIndex: index,
          results,
        },
      }
    }

    results.push({
      index,
      action: step.action,
      ok: true,
      payload: result.payload,
    })

    if (index < payload.steps.length - 1) {
      await sleep(getFlowDelayMs())
    }
  }

  return {
    ok: true,
    payload: {
      results,
    },
  }
}

async function dispatchFlowStep(
  step: FlowStep,
  dispatchBrowserCommand: <T extends keyof CommandPayloadMap>(
    command: T,
    nextPayload: CommandPayloadMap[T],
  ) => Promise<DispatchResult>,
  clickController: AutoBrowserServiceOptions['clickController'],
  keyboardController: KeyboardController,
): Promise<DispatchResult> {
  switch (step.action) {
    case 'open':
      return await dispatchBrowserCommand('open', {
        url: step.url,
      })
    case 'close':
      return await dispatchBrowserCommand('close', {
        ...(typeof step.tabId === 'number' ? { tabId: step.tabId } : {}),
      })
    case 'query':
      return await dispatchBrowserCommand('query', {
        selector: step.selector,
        ...(typeof step.tabId === 'number' ? { tabId: step.tabId } : {}),
      })
    case 'summary':
      return await dispatchBrowserCommand('summary', {
        ...(typeof step.tabId === 'number' ? { tabId: step.tabId } : {}),
      })
    case 'text':
      return await dispatchBrowserCommand('text', {
        selector: step.selector,
        ...(typeof step.tabId === 'number' ? { tabId: step.tabId } : {}),
      })
    case 'click':
      return await dispatchClickCommand(step, dispatchBrowserCommand, clickController)
    case 'input':
      return await dispatchInputCommand(step, dispatchBrowserCommand, clickController, keyboardController)
  }
}

async function dispatchInputCommand(
  payload: InputCommandPayload,
  dispatchBrowserCommand: <T extends keyof CommandPayloadMap>(
    command: T,
    nextPayload: CommandPayloadMap[T],
  ) => Promise<DispatchResult>,
  clickController: AutoBrowserServiceOptions['clickController'],
  keyboardController: KeyboardController,
): Promise<DispatchResult<InputCommandResultPayload>> {
  const clickResult = await dispatchClickCommand(payload, dispatchBrowserCommand, clickController)
  if (!clickResult.ok) {
    return clickResult
  }

  const typed = await keyboardController.typeText(payload.value)

  return {
    ok: true,
    payload: {
      typed: true,
      tabId: clickResult.payload.tabId,
      strategy: typed.strategy,
      ...(typed.inputSource ? { inputSource: typed.inputSource } : {}),
    },
  }
}

async function dispatchScrollCommand(
  payload: ScrollCommandPayload,
  dispatchBrowserCommand: <T extends keyof CommandPayloadMap>(
    command: T,
    nextPayload: CommandPayloadMap[T],
  ) => Promise<DispatchResult>,
  clickController: AutoBrowserServiceOptions['clickController'],
  sleep: (ms: number) => Promise<void>,
): Promise<DispatchResult<ScrollCommandResultPayload>> {
  const tabId = await resolveClickTabId(payload.tabId, dispatchBrowserCommand)
  if (!tabId.ok) {
    return tabId
  }

  if (!clickController?.scrollAtScreenPoint) {
    return {
      ok: false,
      error: 'scroll controller not available',
    }
  }

  await clickController.focusBrowserWindow(tabId.payload)

  const activation = await dispatchBrowserCommand('scroll', {
    deltaX: payload.deltaX,
    deltaY: payload.deltaY,
    tabId: tabId.payload,
  })
  if (!activation.ok) {
    return activation
  }

  await sleep(1000)

  await clickController.scrollAtScreenPoint({
    x: payload.deltaX,
    y: payload.deltaY,
  })

  return {
    ok: true,
    payload: {
      scrolled: true,
      tabId: tabId.payload,
      deltaX: payload.deltaX,
      deltaY: payload.deltaY,
    },
  }
}

async function dispatchClickCommand(
  payload: ClickCommandPayload,
  dispatchBrowserCommand: <T extends keyof CommandPayloadMap>(
    command: T,
    nextPayload: CommandPayloadMap[T],
  ) => Promise<DispatchResult>,
  clickController: AutoBrowserServiceOptions['clickController'],
): Promise<DispatchResult<ClickCommandResultPayload>> {
  const tabId = await resolveClickTabId(payload.tabId, dispatchBrowserCommand)
  if (!tabId.ok) {
    return tabId
  }

  await clickController?.focusBrowserWindow(tabId.payload)

  let mapping = clickController?.getMapping(tabId.payload)

  if (!mapping) {
    const start = await dispatchBrowserCommand('clickMapStart', {
      tabId: tabId.payload,
    })
    if (!start.ok) {
      return start
    }

    const startPayload = start.payload as ClickMapStartResultPayload
    const calibrationBrowserPoints = pickCalibrationPoints(startPayload.rect)
    const calibrationScreenPoints = calibrationBrowserPoints.map((point) =>
      estimateViewportScreenPoint(point, startPayload.window, startPayload.zoom),
    )

    for (const point of calibrationScreenPoints) {
      await clickController?.clickAtScreenPoint(point)
    }

    const finish = await dispatchBrowserCommand('clickMapFinish', {
      tabId: tabId.payload,
    })
    if (!finish.ok) {
      return finish
    }

    const finishPayload = finish.payload as ClickMapFinishResultPayload
    if (finishPayload.points.length < 2) {
      return {
        ok: false,
        error: 'click mapping did not capture enough points',
      }
    }

    mapping = deriveCoordinateMapping(finishPayload.points, calibrationScreenPoints)
    clickController?.setMapping(tabId.payload, mapping)
  }

  const rectResult = await dispatchBrowserCommand('rect', {
    selector: payload.selector,
    tabId: tabId.payload,
  })
  if (!rectResult.ok) {
    return rectResult
  }

  const domRect = rectResult.payload as DomRectPayload
  if (!domRect.found || !domRect.rect) {
    return {
      ok: false,
      error: `selector not found: ${payload.selector}`,
    }
  }

  const browserTarget = pickElementTargetPoint(domRect.rect)
  const screenTarget = applyCoordinateMapping(mapping, browserTarget)
  await clickController?.clickAtScreenPoint(screenTarget)

  return {
    ok: true,
    payload: {
      clicked: true,
      tabId: tabId.payload,
    },
  }
}

async function resolveClickTabId(
  tabId: number | undefined,
  dispatchBrowserCommand: <T extends keyof CommandPayloadMap>(
    command: T,
    nextPayload: CommandPayloadMap[T],
  ) => Promise<DispatchResult>,
): Promise<DispatchResult<number>> {
  if (typeof tabId === 'number') {
    return {
      ok: true,
      payload: tabId,
    }
  }

  const tabs = await dispatchBrowserCommand('tabs', {})
  if (!tabs.ok) {
    return tabs as DispatchResult<number>
  }

  const activeTab = (tabs.payload as BrowserTabPayload[]).find((tab) => tab.active)
  if (!activeTab) {
    return {
      ok: false,
      error: 'no active tab',
    }
  }

  return {
    ok: true,
    payload: activeTab.tabId,
  }
}

function pickCalibrationPoints(rect: ClickMapStartResultPayload['rect']): Point[] {
  return [
    {
      x: rect.left + rect.width * 0.25,
      y: rect.top + rect.height * 0.3,
    },
    {
      x: rect.left + rect.width * 0.75,
      y: rect.top + rect.height * 0.7,
    },
  ]
}

function estimateViewportScreenPoint(
  point: Point,
  windowMetrics: ClickMapStartResultPayload['window'],
  zoom: number,
): Point {
  const horizontalInset = Math.max(0, (windowMetrics.outerWidth - windowMetrics.innerWidth) / 2)
  const verticalInset = Math.max(0, windowMetrics.outerHeight - windowMetrics.innerHeight - horizontalInset)
  const zoomFactor = Number.isFinite(zoom) && zoom > 0 ? zoom : 1

  return {
    x: windowMetrics.screenLeft + horizontalInset + point.x * zoomFactor,
    y: windowMetrics.screenTop + verticalInset + point.y * zoomFactor,
  }
}

function deriveCoordinateMapping(browserPoints: Point[], screenPoints: Point[]): CoordinateMapping {
  const [browserA, browserB] = browserPoints
  const [screenA, screenB] = screenPoints
  const deltaBrowserX = browserB.x - browserA.x || 1
  const deltaBrowserY = browserB.y - browserA.y || 1
  const scaleX = (screenB.x - screenA.x) / deltaBrowserX
  const scaleY = (screenB.y - screenA.y) / deltaBrowserY

  return {
    scaleX,
    scaleY,
    offsetX: screenA.x - browserA.x * scaleX,
    offsetY: screenA.y - browserA.y * scaleY,
  }
}

function pickElementTargetPoint(rect: NonNullable<DomRectPayload['rect']>): Point {
  return {
    x: rect.left + rect.width * 0.52,
    y: rect.top + rect.height * 0.48,
  }
}

function applyCoordinateMapping(mapping: CoordinateMapping, point: Point): Point {
  return {
    x: point.x * mapping.scaleX + mapping.offsetX,
    y: point.y * mapping.scaleY + mapping.offsetY,
  }
}

function nextFlowDelayMs(): number {
  return 500 + Math.round(Math.random() * 1500)
}

async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}
