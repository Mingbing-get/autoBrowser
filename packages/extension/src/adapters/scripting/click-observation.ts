import type {
  ClickObserveCommandPayload,
  ClickObserveCommandResultPayload,
  ClickObserveFinishCommandPayload,
  ClickObserveFinishResultPayload,
  ClickObserveStartCommandPayload,
  ClickObserveStartResultPayload,
  ObservedRegionPayload,
} from '@autobrowser/shared'
import {
  buildFallbackObservation,
  CLICK_OBSERVATION_STATE_KEY,
  createObservationDomHelpers,
  getDefaultObservationOptions,
  type ObservationState,
} from './click-observation-helpers.js'

export async function observeClickInTab(
  tabId: number,
  payload: ClickObserveCommandPayload,
): Promise<ClickObserveCommandResultPayload> {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: observeClickAction as (...args: unknown[]) => unknown,
    args: [payload],
  })

  const observed = result?.result as ClickObserveCommandResultPayload | undefined
  return (
    observed
      ? {
          ...observed,
          tabId,
        }
      : {
          clicked: false,
          tabId,
          observation: buildFallbackObservation(),
        }
  )
}

export async function startClickObservationInTab(
  tabId: number,
  payload: ClickObserveStartCommandPayload,
): Promise<ClickObserveStartResultPayload> {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: startClickObservationAction as (...args: unknown[]) => unknown,
    args: [payload],
  })

  return (
    (result?.result as ClickObserveStartResultPayload | undefined) ?? {
      started: false,
      tabId,
    }
  )
}

export async function finishClickObservationInTab(
  tabId: number,
  payload: ClickObserveFinishCommandPayload,
): Promise<ClickObserveFinishResultPayload> {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: finishClickObservationAction as (...args: unknown[]) => unknown,
    args: [payload],
  })

  return (
    (result?.result as ClickObserveFinishResultPayload | undefined) ?? {
      tabId,
      observation: buildFallbackObservation(),
    }
  )
}

function getObservationState(): ObservationState | undefined {
  return (
    window as typeof window & {
      [CLICK_OBSERVATION_STATE_KEY]?: ObservationState
    }
  )[CLICK_OBSERVATION_STATE_KEY]
}

function setObservationState(state: ObservationState) {
  ;(
    window as typeof window & {
      [CLICK_OBSERVATION_STATE_KEY]?: ObservationState
    }
  )[CLICK_OBSERVATION_STATE_KEY] = state
}

export function startClickObservationAction(
  payload: ClickObserveStartCommandPayload,
): ClickObserveStartResultPayload {
  const options = {
    ...getDefaultObservationOptions(),
    ...(payload.observe ?? {}),
  }
  const helpers = createObservationDomHelpers(options)

  const existing = getObservationState()
  existing?.cleanup()

  const anchor = payload.selector ? document.querySelector(payload.selector) : null
  if (!anchor) {
    return {
      started: false,
      tabId: payload.tabId ?? 0,
    }
  }

  const beforeEntries = helpers.collectMeaningfulElements(document.body).map((element) => {
    const snapshot = helpers.summarizeMeaningfulNode(element)
    return [snapshot.key, snapshot] as [string, typeof snapshot]
  })

  const changedNodes = new Set<Element>()
  const originalFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : undefined
  const OriginalXMLHttpRequest = window.XMLHttpRequest
  let pendingRequests = 0
  let networkEvents = 0
  let meaningfulMutations = 0
  let lastMeaningfulMutationAt = Date.now()
  let lastNetworkActivityAt = Date.now()
  let lastFocusChangeAt = Date.now()
  const startedAt = Date.now()
  const initialUrl = window.location.href

  const markChanged = (element: Element | null | undefined) => {
    if (!element || !helpers.isVisible(element)) {
      return
    }

    changedNodes.add(element)
    meaningfulMutations += 1
    lastMeaningfulMutationAt = Date.now()
  }

  const onFocusIn = (event: FocusEvent) => {
    if (event.target instanceof Element) {
      markChanged(event.target)
      lastFocusChangeAt = Date.now()
    }
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.target instanceof Element) {
        markChanged(mutation.target)
      }

      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof Element) {
          markChanged(node)
        }
      }
    }
  })

  const WrappedXMLHttpRequest = class extends OriginalXMLHttpRequest {
    send(...args: Parameters<XMLHttpRequest['send']>) {
      pendingRequests += 1
      networkEvents += 1
      lastNetworkActivityAt = Date.now()

      const finalize = () => {
        pendingRequests = Math.max(0, pendingRequests - 1)
        lastNetworkActivityAt = Date.now()
        this.removeEventListener('loadend', finalize)
        this.removeEventListener('error', finalize)
        this.removeEventListener('abort', finalize)
      }

      this.addEventListener('loadend', finalize)
      this.addEventListener('error', finalize)
      this.addEventListener('abort', finalize)
      return super.send(...args)
    }
  }

  if (originalFetch) {
    window.fetch = (async (...args: Parameters<typeof window.fetch>) => {
      pendingRequests += 1
      networkEvents += 1
      lastNetworkActivityAt = Date.now()
      try {
        return await originalFetch(...args)
      } finally {
        pendingRequests = Math.max(0, pendingRequests - 1)
        lastNetworkActivityAt = Date.now()
      }
    }) as typeof window.fetch
  }

  window.XMLHttpRequest = WrappedXMLHttpRequest as typeof XMLHttpRequest
  document.addEventListener('focusin', onFocusIn, true)
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
    attributeFilter: ['class', 'style', 'hidden', 'role', 'aria-expanded', 'aria-selected', 'aria-checked'],
  })

  setObservationState({
    anchor,
    beforeEntries: [...beforeEntries],
    changedNodes,
    options,
    startedAt,
    initialUrl,
    getPendingRequests: () => pendingRequests,
    getNetworkEvents: () => networkEvents,
    getMeaningfulMutations: () => meaningfulMutations,
    getLastMeaningfulMutationAt: () => lastMeaningfulMutationAt,
    getLastNetworkActivityAt: () => lastNetworkActivityAt,
    getLastFocusChangeAt: () => lastFocusChangeAt,
    summarizeMeaningfulNode: helpers.summarizeMeaningfulNode,
    collectMeaningfulElements: helpers.collectMeaningfulElements,
    isMeaningfulElementSelf: helpers.isMeaningfulElementSelf,
    cleanup: () => {
      observer.disconnect()
      document.removeEventListener('focusin', onFocusIn, true)
      if (originalFetch) {
        window.fetch = originalFetch
      }
      window.XMLHttpRequest = OriginalXMLHttpRequest
      delete (window as typeof window & { [CLICK_OBSERVATION_STATE_KEY]?: unknown })[CLICK_OBSERVATION_STATE_KEY]
    },
  })

  return {
    started: true,
    tabId: payload.tabId ?? 0,
  }
}

export async function finishClickObservationAction(
  payload: ClickObserveFinishCommandPayload,
): Promise<ClickObserveFinishResultPayload> {
  const observationState = getObservationState()
  const fallbackObservation = buildFallbackObservation()

  if (!observationState) {
    return {
      tabId: payload.tabId ?? 0,
      observation: fallbackObservation,
    }
  }

  const options = {
    ...observationState.options,
    ...(payload.observe ?? {}),
  }
  const helpers = createObservationDomHelpers(options)
  let endedBy: ClickObserveFinishResultPayload['observation']['meta']['endedBy'] = 'no-change'

  try {
    if (payload.awaitStability !== false) {
      while (true) {
        const now = Date.now()
        const elapsed = now - observationState.startedAt
        const navigationChanged = window.location.href !== observationState.initialUrl

        if (navigationChanged) {
          endedBy = 'navigation'
          break
        }

        if (elapsed >= options.maxObserveMs) {
          endedBy = 'max-timeout'
          break
        }

        if (elapsed >= options.minObserveMs) {
          const domIdle = now - observationState.getLastMeaningfulMutationAt() >= options.stableWindowMs
          const networkIdle =
            observationState.getPendingRequests() === 0 &&
            now - observationState.getLastNetworkActivityAt() >= options.stableWindowMs
          const focusIdle = now - observationState.getLastFocusChangeAt() >= options.stableWindowMs

          if (domIdle && networkIdle && focusIdle) {
            endedBy = observationState.getMeaningfulMutations() > 0 ? 'stabilized' : 'no-change'
            break
          }
        }

        await new Promise((resolve) => window.setTimeout(resolve, 25))
      }
    }

    const roots = helpers.dedupeRegionRoots(
      Array.from(observationState.changedNodes)
        .map((node) => helpers.findRegionRoot(node, observationState.anchor, observationState.collectMeaningfulElements))
        .filter((node, index, list): node is Element => Boolean(node) && list.indexOf(node) === index),
      observationState.anchor,
    ).slice(0, options.maxRegions)

    const beforeIndex = new Map(observationState.beforeEntries)
    const regions = roots.map((root): ObservedRegionPayload => {
      const tree = observationState.summarizeMeaningfulNode(root)
      const afterIndex = helpers.indexTree(tree)
      const beforeLocal = new Map<string, typeof tree>()

      for (const key of afterIndex.keys()) {
        const previous = beforeIndex.get(key)
        if (previous) {
          beforeLocal.set(key, previous)
        }
      }

      return {
        key: tree.key,
        role: tree.role,
        locator: tree.locator,
        confidence: 1,
        reasons: ['mutation-observed'],
        changedNodes: helpers.diffIndexes(beforeLocal, afterIndex),
        tree,
      }
    })

    const activeElement =
      document.activeElement instanceof Element && observationState.isMeaningfulElementSelf(document.activeElement)
        ? observationState.summarizeMeaningfulNode(document.activeElement)
        : undefined

    return {
      tabId: payload.tabId ?? 0,
      observation: {
        primaryEffect: helpers.classifyPrimaryEffect(regions, window.location.href !== observationState.initialUrl),
        regions,
        ...(activeElement ? { activeElement } : {}),
        navigation: {
          from: observationState.initialUrl,
          to: window.location.href,
          changed: window.location.href !== observationState.initialUrl,
        },
        meta: {
          durationMs: Date.now() - observationState.startedAt,
          endedBy,
          networkEvents: observationState.getNetworkEvents(),
          meaningfulMutations: observationState.getMeaningfulMutations(),
        },
      },
    }
  } finally {
    observationState.cleanup()
  }
}

export async function observeClickAction(
  payload: ClickObserveCommandPayload,
): Promise<ClickObserveCommandResultPayload> {
  const options = {
    ...getDefaultObservationOptions(),
    ...(payload.observe ?? {}),
  }
  const helpers = createObservationDomHelpers(options)
  const anchor = payload.selector ? document.querySelector(payload.selector) : null
  const initialUrl = window.location.href

  if (!anchor) {
    return {
      clicked: false,
      tabId: payload.tabId ?? 0,
      observation: {
        ...buildFallbackObservation(),
        navigation: {
          from: initialUrl,
          to: initialUrl,
          changed: false,
        },
      },
    }
  }

  const beforeIndex = new Map<string, ReturnType<typeof helpers.summarizeMeaningfulNode>>()
  for (const element of helpers.collectMeaningfulElements(document.body)) {
    const snapshot = helpers.summarizeMeaningfulNode(element)
    beforeIndex.set(snapshot.key, snapshot)
  }

  const changedNodes = new Set<Element>()
  const originalFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : undefined
  const OriginalXMLHttpRequest = window.XMLHttpRequest
  let pendingRequests = 0
  let networkEvents = 0
  let meaningfulMutations = 0
  let lastMeaningfulMutationAt = Date.now()
  let lastNetworkActivityAt = Date.now()
  let lastFocusChangeAt = Date.now()
  const startedAt = Date.now()

  const markChanged = (element: Element | null | undefined) => {
    if (!element || !helpers.isVisible(element)) {
      return
    }

    changedNodes.add(element)
    meaningfulMutations += 1
    lastMeaningfulMutationAt = Date.now()
  }

  const onFocusIn = (event: FocusEvent) => {
    if (event.target instanceof Element) {
      markChanged(event.target)
      lastFocusChangeAt = Date.now()
    }
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.target instanceof Element) {
        markChanged(mutation.target)
      }

      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof Element) {
          markChanged(node)
        }
      }

      if (mutation.type === 'childList' && mutation.target instanceof Element) {
        markChanged(mutation.target)
      }
    }
  })

  const WrappedXMLHttpRequest = class extends OriginalXMLHttpRequest {
    send(...args: Parameters<XMLHttpRequest['send']>) {
      pendingRequests += 1
      networkEvents += 1
      lastNetworkActivityAt = Date.now()

      const finalize = () => {
        pendingRequests = Math.max(0, pendingRequests - 1)
        lastNetworkActivityAt = Date.now()
        this.removeEventListener('loadend', finalize)
        this.removeEventListener('error', finalize)
        this.removeEventListener('abort', finalize)
      }

      this.addEventListener('loadend', finalize)
      this.addEventListener('error', finalize)
      this.addEventListener('abort', finalize)
      return super.send(...args)
    }
  }

  if (originalFetch) {
    window.fetch = (async (...args: Parameters<typeof window.fetch>) => {
      pendingRequests += 1
      networkEvents += 1
      lastNetworkActivityAt = Date.now()
      try {
        return await originalFetch(...args)
      } finally {
        pendingRequests = Math.max(0, pendingRequests - 1)
        lastNetworkActivityAt = Date.now()
      }
    }) as typeof window.fetch
  }

  window.XMLHttpRequest = WrappedXMLHttpRequest as typeof XMLHttpRequest
  document.addEventListener('focusin', onFocusIn, true)
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
    attributeFilter: ['class', 'style', 'hidden', 'role', 'aria-expanded', 'aria-selected', 'aria-checked'],
  })

  ;(anchor as HTMLElement).click()

  let endedBy: ClickObserveCommandResultPayload['observation']['meta']['endedBy'] = 'max-timeout'
  try {
    while (true) {
      const now = Date.now()
      const elapsed = now - startedAt
      const navigationChanged = window.location.href !== initialUrl

      if (navigationChanged) {
        endedBy = 'navigation'
        break
      }

      if (elapsed >= options.maxObserveMs) {
        endedBy = 'max-timeout'
        break
      }

      if (elapsed >= options.minObserveMs) {
        const domIdle = now - lastMeaningfulMutationAt >= options.stableWindowMs
        const networkIdle = pendingRequests === 0 && now - lastNetworkActivityAt >= options.stableWindowMs
        const focusIdle = now - lastFocusChangeAt >= options.stableWindowMs

        if (domIdle && networkIdle && focusIdle) {
          endedBy = meaningfulMutations > 0 ? 'stabilized' : 'no-change'
          break
        }
      }

      await new Promise((resolve) => window.setTimeout(resolve, 25))
    }
  } finally {
    observer.disconnect()
    document.removeEventListener('focusin', onFocusIn, true)
    if (originalFetch) {
      window.fetch = originalFetch
    }
    window.XMLHttpRequest = OriginalXMLHttpRequest
  }

  const roots = helpers.dedupeRegionRoots(
    Array.from(changedNodes)
      .map((node) => helpers.findRegionRoot(node, anchor))
      .filter((node, index, list): node is Element => Boolean(node) && list.indexOf(node) === index),
    anchor,
  ).slice(0, options.maxRegions)

  const regions = roots.map((root): ObservedRegionPayload => {
    const tree = helpers.summarizeMeaningfulNode(root)
    const afterIndex = helpers.indexTree(tree)
    const beforeLocal = new Map<string, typeof tree>()

    for (const key of afterIndex.keys()) {
      const previous = beforeIndex.get(key)
      if (previous) {
        beforeLocal.set(key, previous)
      }
    }

    return {
      key: tree.key,
      role: tree.role,
      locator: tree.locator,
      confidence: 1,
      reasons: ['mutation-observed'],
      changedNodes: helpers.diffIndexes(beforeLocal, afterIndex),
      tree,
    }
  })

  const activeElement =
    document.activeElement instanceof Element && helpers.isMeaningfulElementSelf(document.activeElement)
      ? helpers.summarizeMeaningfulNode(document.activeElement)
      : undefined

  return {
    clicked: true,
    tabId: payload.tabId ?? 0,
    observation: {
      primaryEffect: helpers.classifyPrimaryEffect(regions, window.location.href !== initialUrl),
      regions,
      ...(activeElement ? { activeElement } : {}),
      navigation: {
        from: initialUrl,
        to: window.location.href,
        changed: window.location.href !== initialUrl,
      },
      meta: {
        durationMs: Date.now() - startedAt,
        endedBy,
        networkEvents,
        meaningfulMutations,
      },
    },
  }
}
