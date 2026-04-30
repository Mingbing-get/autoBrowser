import type {
  BrowserTabPayload,
  ClientRectPayload,
  ClickCommandPayload,
  ClickCommandResultPayload,
  ClickObserveCommandPayload,
  ClickObserveCommandResultPayload,
  ClickObserveFinishResultPayload,
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

const MAX_CLICK_SCROLL_ATTEMPTS = 8

type ViewRect = Pick<ClientRectPayload, 'left' | 'top' | 'right' | 'bottom'>

type ResolvedDomRect = {
  rect: NonNullable<DomRectPayload['rect']>
  viewport: NonNullable<DomRectPayload['viewport']>
  scrollableAncestors: NonNullable<DomRectPayload['scrollableAncestors']>
}

type BlockingTarget =
  | {
      kind: 'ancestor'
      visibleRect: ViewRect
    }
  | {
      kind: 'viewport'
      visibleRect: ViewRect
    }

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

      if (command === 'clickObserve') {
        return await dispatchClickObserveCommand(
          payload as ClickObserveCommandPayload,
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

  let previousSnapshotKey: string | undefined

  for (let attempt = 0; attempt < MAX_CLICK_SCROLL_ATTEMPTS; attempt += 1) {
    const rectResult = await dispatchBrowserCommand('rect', {
      selector: payload.selector,
      tabId: tabId.payload,
    })
    if (!rectResult.ok) {
      return rectResult
    }

    const domRect = coerceDomRectPayload(rectResult.payload as DomRectPayload)
    if (!domRect) {
      return {
        ok: false,
        error: `selector not found: ${payload.selector}`,
      }
    }

    const blocker = findBlockingTarget(domRect)
    if (!blocker) {
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

    const snapshotKey = buildVisibilitySnapshotKey(domRect)
    if (snapshotKey === previousSnapshotKey) {
      return {
        ok: false,
        error: `element cannot be brought into view: ${payload.selector}`,
      }
    }

    const scrollDelta = computeScrollDelta(domRect.rect, blocker.visibleRect)
    if (scrollDelta.x === 0 && scrollDelta.y === 0) {
      return {
        ok: false,
        error: `element cannot be brought into view: ${payload.selector}`,
      }
    }

    const scrollTarget = findNearestScrollableTarget(domRect)
    const anchorRect = scrollTarget?.visibleRect ?? blocker.visibleRect
    const anchorCandidates = pickScrollAnchorPoints(anchorRect)
    let scrollSucceeded = false

    for (const anchor of anchorCandidates) {
      if (clickController?.moveMouseToScreenPoint) {
        const screenAnchor = applyCoordinateMapping(mapping, anchor)
        await clickController.moveMouseToScreenPoint(screenAnchor)
      }

      await clickController?.scrollAtScreenPoint?.(scrollDelta)

      const probeResult = await dispatchBrowserCommand('rect', {
        selector: payload.selector,
        tabId: tabId.payload,
      })
      if (!probeResult.ok) {
        return probeResult
      }

      const probedRect = coerceDomRectPayload(probeResult.payload as DomRectPayload)
      if (!probedRect) {
        return {
          ok: false,
          error: `selector not found: ${payload.selector}`,
        }
      }

      const remainingBlocker = findBlockingTarget(probedRect)
      if (!remainingBlocker) {
        const browserTarget = pickElementTargetPoint(probedRect.rect)
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

      if (didScrollTargetMove(domRect, probedRect, scrollTarget)) {
        scrollSucceeded = true
        previousSnapshotKey = snapshotKey
        break
      }
    }

    if (!scrollSucceeded) {
      return {
        ok: false,
        error: `element cannot be brought into view: ${payload.selector}`,
      }
    }

    previousSnapshotKey = snapshotKey
  }

  return {
    ok: false,
    error: `element cannot be brought into view: ${payload.selector}`,
  }
}

async function dispatchClickObserveCommand(
  payload: ClickObserveCommandPayload,
  dispatchBrowserCommand: <T extends keyof CommandPayloadMap>(
    command: T,
    nextPayload: CommandPayloadMap[T],
  ) => Promise<DispatchResult>,
  clickController: AutoBrowserServiceOptions['clickController'],
): Promise<DispatchResult<ClickObserveCommandResultPayload>> {
  const tabId = await resolveClickTabId(payload.tabId, dispatchBrowserCommand)
  if (!tabId.ok) {
    return tabId
  }

  const start = await dispatchBrowserCommand('clickObserveStart', {
    selector: payload.selector,
    tabId: tabId.payload,
    ...(payload.observe ? { observe: payload.observe } : {}),
  })
  if (!start.ok) {
    return start as DispatchResult<ClickObserveCommandResultPayload>
  }

  const clickResult = await dispatchClickCommand(
    {
      selector: payload.selector,
      tabId: tabId.payload,
    },
    dispatchBrowserCommand,
    clickController,
  )

  if (!clickResult.ok) {
    return clickResult as DispatchResult<ClickObserveCommandResultPayload>
  }

  const finish = await dispatchBrowserCommand('clickObserveFinish', {
    tabId: tabId.payload,
    awaitStability: clickResult.ok,
    ...(payload.observe ? { observe: payload.observe } : {}),
  })

  if (!finish.ok) {
    return finish as DispatchResult<ClickObserveCommandResultPayload>
  }

  const finishPayload = finish.payload as ClickObserveFinishResultPayload
  return {
    ok: true,
    payload: {
      clicked: true,
      tabId: tabId.payload,
      observation: finishPayload.observation,
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

function coerceDomRectPayload(payload: DomRectPayload): ResolvedDomRect | undefined {
  if (!payload.found || !payload.rect) {
    return undefined
  }

  return {
    rect: payload.rect,
    viewport: payload.viewport ?? {
      innerWidth: 0,
      innerHeight: 0,
      scrollX: 0,
      scrollY: 0,
    },
    scrollableAncestors: payload.scrollableAncestors ?? [],
  }
}

function findBlockingTarget(snapshot: ResolvedDomRect): BlockingTarget | undefined {
  const clickPoint = pickElementTargetPoint(snapshot.rect)
  const viewportRect = viewportToRect(snapshot.viewport)
  const ancestorRects = buildAncestorVisibleRects(snapshot.scrollableAncestors, viewportRect)

  for (let index = 0; index < ancestorRects.length; index += 1) {
    const candidate = ancestorRects[index]
    if (snapshot.scrollableAncestors[index]?.isRootScroller) {
      continue
    }

    if (!isPointVisible(clickPoint, candidate.visibleRect)) {
      return {
        kind: 'ancestor',
        visibleRect: candidate.visibleRect,
      }
    }
  }

  if (!isPointVisible(clickPoint, viewportRect)) {
    return {
      kind: 'viewport',
      visibleRect: viewportRect,
    }
  }

  return undefined
}

function buildAncestorVisibleRects(
  ancestors: NonNullable<DomRectPayload['scrollableAncestors']>,
  viewportRect: ViewRect,
) {
  const byIndex = new Map<number, ViewRect>()
  let clippingRect = viewportRect

  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    clippingRect = ancestors[index].isRootScroller
      ? viewportRect
      : intersectRects(clippingRect, ancestors[index].rect)
    byIndex.set(index, clippingRect)
  }

  return ancestors.map((_: NonNullable<DomRectPayload['scrollableAncestors']>[number], index: number) => ({
    visibleRect: byIndex.get(index) ?? viewportRect,
  }))
}

function findNearestScrollableAnchorRect(snapshot: ResolvedDomRect): ViewRect | undefined {
  return findNearestScrollableTarget(snapshot)?.visibleRect
}

function findNearestScrollableTarget(snapshot: ResolvedDomRect): { index: number; visibleRect: ViewRect } | undefined {
  const viewportRect = viewportToRect(snapshot.viewport)
  const ancestorRects = buildAncestorVisibleRects(snapshot.scrollableAncestors, viewportRect)

  for (let index = 0; index < ancestorRects.length; index += 1) {
    const candidate = ancestorRects[index]?.visibleRect
    if (candidate && hasVisibleArea(candidate)) {
      return {
        index,
        visibleRect: candidate,
      }
    }
  }

  return undefined
}

function viewportToRect(viewport: ResolvedDomRect['viewport']): ViewRect {
  return {
    left: 0,
    top: 0,
    right: viewport.innerWidth,
    bottom: viewport.innerHeight,
  }
}

function isPointVisible(point: Point, visibleRect: ViewRect) {
  return (
    point.x >= visibleRect.left &&
    point.x <= visibleRect.right &&
    point.y >= visibleRect.top &&
    point.y <= visibleRect.bottom
  )
}

function intersectRects(a: ViewRect, b: ViewRect): ViewRect {
  return {
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  }
}

function hasVisibleArea(rect: ViewRect) {
  return rect.right > rect.left && rect.bottom > rect.top
}

function buildVisibilitySnapshotKey(snapshot: ResolvedDomRect) {
  return JSON.stringify({
    rect: snapshot.rect,
    viewport: {
      scrollX: snapshot.viewport.scrollX,
      scrollY: snapshot.viewport.scrollY,
      innerWidth: snapshot.viewport.innerWidth,
      innerHeight: snapshot.viewport.innerHeight,
    },
    scrollableAncestors: snapshot.scrollableAncestors.map((ancestor: NonNullable<DomRectPayload['scrollableAncestors']>[number]) => ({
      rect: ancestor.rect,
      scrollLeft: ancestor.scrollLeft,
      scrollTop: ancestor.scrollTop,
    })),
  })
}

function computeScrollDelta(rect: ResolvedDomRect['rect'], visibleRect: ViewRect): Point {
  const point = pickElementTargetPoint(rect)

  return {
    x: computeAxisScrollDelta({
      point: point.x,
      min: visibleRect.left,
      max: visibleRect.right,
      positiveDirection: 'left',
      negativeDirection: 'right',
    }),
    y: computeAxisScrollDelta({
      point: point.y,
      min: visibleRect.top,
      max: visibleRect.bottom,
      positiveDirection: 'up',
      negativeDirection: 'down',
    }),
  }
}

function computeAxisScrollDelta({
  point,
  min,
  max,
  positiveDirection,
  negativeDirection,
}: {
  point: number
  min: number
  max: number
  positiveDirection: 'left' | 'up'
  negativeDirection: 'right' | 'down'
}) {
  if (point > max) {
    const baseDelta = point - max
    const maxSafeBuffer = Math.max(0, point - min)
    return directionSign(negativeDirection) * (baseDelta + computeSafeBuffer(maxSafeBuffer))
  }

  if (point < min) {
    const baseDelta = min - point
    const maxSafeBuffer = Math.max(0, max - point)
    return directionSign(positiveDirection) * (baseDelta + computeSafeBuffer(maxSafeBuffer))
  }

  return 0
}

function directionSign(direction: 'left' | 'right' | 'up' | 'down') {
  if (direction === 'left' || direction === 'up') {
    return 1
  }

  return -1
}

function computeSafeBuffer(maxSafeBuffer: number) {
  if (maxSafeBuffer <= 0) {
    return 0
  }

  if (maxSafeBuffer >= 100) {
    return 100
  }

  return maxSafeBuffer / 2
}

function pickScrollAnchorPoint(visibleRect: ViewRect): Point {
  return pickScrollAnchorPoints(visibleRect)[0]
}

function pickScrollAnchorPoints(visibleRect: ViewRect): Point[] {
  const left = Math.min(visibleRect.left, visibleRect.right)
  const right = Math.max(visibleRect.left, visibleRect.right)
  const top = Math.min(visibleRect.top, visibleRect.bottom)
  const bottom = Math.max(visibleRect.top, visibleRect.bottom)
  const inset = 12
  const insetLeft = Math.min(right, left + inset)
  const insetRight = Math.max(left, right - inset)
  const insetTop = Math.min(bottom, top + inset)
  const insetBottom = Math.max(top, bottom - inset)
  const centerX = clamp((left + right) / 2, insetLeft, insetRight)
  const centerY = clamp((top + bottom) / 2, insetTop, insetBottom)

  return [
    {
      x: centerX,
      y: centerY,
    },
    {
      x: insetLeft,
      y: insetTop,
    },
    {
      x: insetRight,
      y: insetTop,
    },
    {
      x: insetLeft,
      y: insetBottom,
    },
    {
      x: insetRight,
      y: insetBottom,
    },
  ]
}

function didScrollTargetMove(
  before: ResolvedDomRect,
  after: ResolvedDomRect,
  scrollTarget: { index: number; visibleRect: ViewRect } | undefined,
) {
  if (scrollTarget) {
    const beforeAncestor = before.scrollableAncestors[scrollTarget.index]
    const afterAncestor = after.scrollableAncestors[scrollTarget.index]

    if (beforeAncestor && afterAncestor) {
      return beforeAncestor.scrollTop !== afterAncestor.scrollTop || beforeAncestor.scrollLeft !== afterAncestor.scrollLeft
    }
  }

  return before.viewport.scrollX !== after.viewport.scrollX || before.viewport.scrollY !== after.viewport.scrollY
}

function applyCoordinateMapping(mapping: CoordinateMapping, point: Point): Point {
  return {
    x: point.x * mapping.scaleX + mapping.offsetX,
    y: point.y * mapping.scaleY + mapping.offsetY,
  }
}

function clamp(value: number, min: number, max: number) {
  if (min > max) {
    return value
  }

  return Math.min(max, Math.max(min, value))
}

function nextFlowDelayMs(): number {
  return 500 + Math.round(Math.random() * 1500)
}

async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}
