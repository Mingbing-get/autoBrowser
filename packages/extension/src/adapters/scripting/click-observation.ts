import type {
  ClickCommandPayload,
  ClickCommandResultPayload,
  ClickObserveFinishCommandPayload,
  ClickObserveFinishResultPayload,
  ClickObserveStartCommandPayload,
  ClickObserveStartResultPayload,
  MeaningfulNodeSnapshot,
  ObservedRegionPayload,
  PostClickObservationPayload,
} from '@autobrowser/shared'
import { waitForTabComplete } from '../tabs.js'
import {
  buildFallbackObservation,
  CLICK_OBSERVATION_STATE_KEY,
  createObservationDomHelpers,
  getDefaultObservationOptions,
  type ObservationState,
} from './click-observation-helpers.js'

export async function observeClickInTab(
  tabId: number,
  payload: ClickCommandPayload,
): Promise<ClickCommandResultPayload> {
  const [result] = await executeObservationScript(
    tabId,
    injectedClickObservationAction as (...args: unknown[]) => unknown,
    ['observe', payload],
  )

  const observed = result?.result as ClickCommandResultPayload | undefined
  return (
    observed
      ? {
          ...observed,
          tabId,
        }
      : {
          clicked: false,
          tabId,
          observation: {
            ...buildFallbackObservation(),
            meta: {
              ...buildFallbackObservation().meta,
              debugSource: 'adapter-observe-empty-result',
            },
          },
        }
  )
}

export async function startClickObservationInTab(
  tabId: number,
  payload: ClickObserveStartCommandPayload,
): Promise<ClickObserveStartResultPayload> {
  const [result] = await executeObservationScript(
    tabId,
    injectedClickObservationAction as (...args: unknown[]) => unknown,
    ['start', payload],
  )

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
  const [result] = await executeObservationScript(
    tabId,
    injectedClickObservationAction as (...args: unknown[]) => unknown,
    ['finish', payload],
  )

  return (
    (result?.result as ClickObserveFinishResultPayload | undefined) ?? {
      tabId,
      observation: {
        ...buildFallbackObservation(),
        meta: {
          ...buildFallbackObservation().meta,
          debugSource: 'adapter-finish-empty-result',
        },
      },
    }
  )
}

async function executeObservationScript(
  tabId: number,
  func: (...args: unknown[]) => unknown,
  args: unknown[],
) {
  const run = async () =>
    await chrome.scripting.executeScript({
      target: { tabId },
      func,
      args,
    })

  try {
    const initialResult = await run()
    if (hasObservationScriptResult(initialResult)) {
      return initialResult
    }

    await waitForTabComplete(tabId, 4000)

    const retriedResult = await run()
    if (hasObservationScriptResult(retriedResult)) {
      return retriedResult
    }

    throw new Error('observation script returned no result')
  } catch (error) {
    if (!isRetryableFrameError(error)) {
      throw error
    }

    await waitForTabComplete(tabId, 4000)

    const retriedResult = await run()
    if (hasObservationScriptResult(retriedResult)) {
      return retriedResult
    }

    throw new Error('observation script returned no result')
  }
}

function isRetryableFrameError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  return error.message.toLowerCase().includes('frame with id 0 was removed')
}

function hasObservationScriptResult(results: Awaited<ReturnType<typeof chrome.scripting.executeScript>>) {
  return Array.isArray(results) && results.length > 0 && results[0]?.result !== undefined
}

function injectedClickObservationAction(
  operation: 'start' | 'finish' | 'observe',
  payload: ClickObserveStartCommandPayload | ClickObserveFinishCommandPayload | ClickCommandPayload,
) {
  const stateKey = '__autobrowserClickObserveState__'

  function getDefaultObservationOptions() {
    return {
      minObserveMs: 180,
      maxObserveMs: 4000,
      stableWindowMs: 300,
      maxRegions: 8,
      maxItemsPerRegion: 40,
      maxTextLength: 160,
    }
  }

  function buildFallbackObservation() {
    const href = typeof window !== 'undefined' && typeof window.location?.href === 'string' ? window.location.href : ''

    return {
      primaryEffect: 'no-visible-change' as const,
      regions: [],
      navigation: {
        from: href,
        to: href,
        changed: false,
      },
      meta: {
        durationMs: 0,
        endedBy: 'no-change' as const,
        networkEvents: 0,
        meaningfulMutations: 0,
        debugSource: 'page-fallback',
      },
    }
  }

  function createObservationDomHelpers(options: ReturnType<typeof getDefaultObservationOptions>) {
    function normalizeText(value: string | null | undefined) {
      return (value ?? '').replace(/\s+/g, ' ').trim()
    }

    function isVisible(element: Element) {
      if (!(element instanceof HTMLElement)) {
        return true
      }

      const style = window.getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        !element.hidden &&
        rect.width > 0 &&
        rect.height > 0
      )
    }

    function isClickable(element: Element) {
      const tag = element.tagName.toLowerCase()
      const role = element.getAttribute('role')

      if (['button', 'summary'].includes(tag)) {
        return true
      }

      if (tag === 'a' && element.hasAttribute('href')) {
        return true
      }

      if (element instanceof HTMLInputElement) {
        return element.type !== 'hidden'
      }

      return (
        role === 'button' ||
        role === 'link' ||
        role === 'tab' ||
        role === 'menuitem' ||
        role === 'option' ||
        element.hasAttribute('onclick')
      )
    }

    function isEditable(element: Element) {
      return (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement ||
        (element instanceof HTMLElement && element.isContentEditable)
      )
    }

    function isDisabled(element: Element) {
      return (
        (element instanceof HTMLButtonElement ||
          element instanceof HTMLInputElement ||
          element instanceof HTMLSelectElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLOptionElement) &&
        element.disabled
      )
    }

    function isSemanticTag(tag: string) {
      return [
        'main',
        'nav',
        'header',
        'footer',
        'section',
        'article',
        'aside',
        'form',
        'dialog',
        'button',
        'a',
        'label',
        'input',
        'textarea',
        'select',
        'option',
        'img',
        'table',
        'ul',
        'ol',
        'li',
        'h1',
        'h2',
        'h3',
      ].includes(tag)
    }

    function directText(element: Element) {
      return normalizeText(
        Array.from(element.childNodes)
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent ?? '')
          .join(' '),
      )
    }

    function fullInnerText(element: Element) {
      return normalizeText((element as HTMLElement).innerText || element.textContent || '')
    }

    function cssEscape(value: string) {
      if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(value)
      }

      return value.replace(/["\\.#:[\]()]/g, '\\$&')
    }

    function buildCssPath(element: Element, maxDepth = 5) {
      const segments: string[] = []
      let current: Element | null = element

      while (current && segments.length < maxDepth) {
        const tag = current.tagName.toLowerCase()
        const id = current.getAttribute('id')

        if (id) {
          segments.unshift(`#${cssEscape(id)}`)
          break
        }

        const parent: Element | null = current.parentElement
        if (!parent) {
          segments.unshift(tag)
          break
        }

        const siblings = (Array.from(parent.children) as Element[]).filter((child) => child.tagName.toLowerCase() === tag)
        segments.unshift(`${tag}:nth-of-type(${siblings.indexOf(current) + 1})`)
        current = parent
      }

      return segments.join(' > ')
    }

    function buildLocator(element: Element) {
      const tag = element.tagName.toLowerCase()
      const selectors: string[] = []
      const testId = normalizeText(element.getAttribute('data-testid'))
      const id = normalizeText(element.getAttribute('id'))
      const name = normalizeText(element.getAttribute('name'))
      const ariaLabel = normalizeText(element.getAttribute('aria-label'))
      const placeholder = normalizeText(element.getAttribute('placeholder'))

      if (testId) {
        selectors.push(`[data-testid="${cssEscape(testId)}"]`)
      }

      if (id) {
        selectors.push(`#${cssEscape(id)}`)
      }

      if (name) {
        selectors.push(`${tag}[name="${cssEscape(name)}"]`)
      }

      if (ariaLabel) {
        selectors.push(`${tag}[aria-label="${cssEscape(ariaLabel)}"]`)
      }

      if (placeholder) {
        selectors.push(`${tag}[placeholder="${cssEscape(placeholder)}"]`)
      }

      selectors.push(buildCssPath(element))
      const unique = selectors.filter((selector, index) => selector && selectors.indexOf(selector) === index)

      return unique.length > 0
        ? {
            preferred: unique[0],
            ...(unique.length > 1 ? { fallbacks: unique.slice(1) } : {}),
          }
        : undefined
    }

    function collectAttrs(element: Element) {
      const attrs: Record<string, string> = {}
      const keys = [
        'id',
        'class',
        'name',
        'type',
        'href',
        'title',
        'placeholder',
        'role',
        'aria-label',
        'aria-expanded',
        'aria-selected',
        'aria-checked',
        'data-testid',
      ]

      for (const key of keys) {
        const value = normalizeText(element.getAttribute(key))
        if (value) {
          attrs[key] = value
        }
      }

      return Object.keys(attrs).length > 0 ? attrs : undefined
    }

    function isMeaningfulLeafElement(element: Element) {
      return element.tagName.toLowerCase() === 'svg'
    }

    function collectState(element: Element) {
      const state = {
        clickable: isClickable(element) || undefined,
        editable: isEditable(element) || undefined,
        disabled: isDisabled(element) || undefined,
        checked:
          element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type.toLowerCase())
            ? element.checked
            : undefined,
        selected: element instanceof HTMLOptionElement ? element.selected : undefined,
      }

      return Object.values(state).some((value) => value !== undefined) ? state : undefined
    }

    function isMeaningfulElementSelf(element: Element) {
      if (!isVisible(element)) {
        return false
      }

      const tag = element.tagName.toLowerCase()
      if (['script', 'style', 'noscript', 'template'].includes(tag)) {
        return false
      }

      if (isMeaningfulLeafElement(element)) {
        return true
      }

      if (isSemanticTag(tag) || isClickable(element) || isEditable(element)) {
        return true
      }

      if (element.hasAttribute('role') || element.hasAttribute('data-testid')) {
        return true
      }

      return Boolean(directText(element))
    }

    function truncateText(value: string, limit: number) {
      return value.length <= limit ? value : `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`
    }

    function summarizeMeaningfulNode(element: Element): MeaningfulNodeSnapshot {
      const role = normalizeText(element.getAttribute('role')) || undefined
      const text = truncateText(directText(element) || fullInnerText(element), options.maxTextLength)
      const locator = buildLocator(element)
      const key = locator?.preferred ?? `${role ?? element.tagName.toLowerCase()}::${text}`

      if (isMeaningfulLeafElement(element)) {
        return {
          key,
          tag: element.tagName.toLowerCase(),
          role,
          ...(text ? { text } : {}),
          ...(collectAttrs(element) ? { attrs: collectAttrs(element) } : {}),
          ...(collectState(element) ? { state: collectState(element) } : {}),
          ...(locator ? { locator } : {}),
          visible: isVisible(element),
        }
      }

      const children: MeaningfulNodeSnapshot[] = []
      const seenChildKeys = new Set<string>()

      for (const child of Array.from(element.children) as Element[]) {
        if (!isVisible(child)) {
          continue
        }

        if (isMeaningfulElementSelf(child)) {
          const childSummary = summarizeMeaningfulNode(child)
          if (!seenChildKeys.has(childSummary.key)) {
            seenChildKeys.add(childSummary.key)
            children.push(childSummary)
          }
          continue
        }

        for (const descendant of collectMeaningfulChildren(child)) {
          if (!seenChildKeys.has(descendant.key)) {
            seenChildKeys.add(descendant.key)
            children.push(descendant)
          }
        }
      }

      return {
        key,
        tag: element.tagName.toLowerCase(),
        role,
        ...(text ? { text } : {}),
        ...(collectAttrs(element) ? { attrs: collectAttrs(element) } : {}),
        ...(collectState(element) ? { state: collectState(element) } : {}),
        ...(locator ? { locator } : {}),
        visible: isVisible(element),
        ...(children.length > 0 ? { children: children.slice(0, options.maxItemsPerRegion) } : {}),
      }
    }

    function collectMeaningfulChildren(root: Element) {
      const nodes: MeaningfulNodeSnapshot[] = []
      for (const child of Array.from(root.children) as Element[]) {
        if (!isVisible(child)) {
          continue
        }

        if (isMeaningfulElementSelf(child)) {
          nodes.push(summarizeMeaningfulNode(child))
          continue
        }

        if (!isMeaningfulLeafElement(child)) {
          nodes.push(...collectMeaningfulChildren(child))
        }
      }

      return nodes
    }

    function collectMeaningfulElements(root: Element) {
      const elements: Element[] = []
      for (const child of Array.from(root.children) as Element[]) {
        if (!isVisible(child)) {
          continue
        }

        if (isMeaningfulElementSelf(child)) {
          elements.push(child)
        }

        if (!isMeaningfulLeafElement(child)) {
          elements.push(...collectMeaningfulElements(child))
        }
      }

      return elements
    }

    function indexTree(node: MeaningfulNodeSnapshot, into = new Map<string, MeaningfulNodeSnapshot>()) {
      into.set(node.key, node)
      for (const child of node.children ?? []) {
        indexTree(child, into)
      }
      return into
    }

    function shallowEqual(a: unknown, b: unknown) {
      return JSON.stringify(a) === JSON.stringify(b)
    }

    function diffIndexes(before: Map<string, MeaningfulNodeSnapshot>, after: Map<string, MeaningfulNodeSnapshot>) {
      const changes: ObservedRegionPayload['changedNodes'] = []

      for (const [key, nextNode] of after.entries()) {
        const previous = before.get(key)
        if (!previous) {
          changes.push({
            key,
            change: 'added',
            after: nextNode,
          })
          continue
        }

        if (!shallowEqual(previous.text, nextNode.text)) {
          changes.push({
            key,
            change: 'text-updated',
            before: previous,
            after: nextNode,
          })
        } else if (!shallowEqual(previous.attrs, nextNode.attrs) || !shallowEqual(previous.state, nextNode.state)) {
          changes.push({
            key,
            change: 'state-updated',
            before: previous,
            after: nextNode,
          })
        }
      }

      for (const [key, previous] of before.entries()) {
        if (!after.has(key)) {
          changes.push({
            key,
            change: 'removed',
            before: previous,
          })
        }
      }

      return changes
    }

    function findRegionRoot(node: Element, anchor: Element, collectElements = collectMeaningfulElements) {
      const directOverlayDescendant = node.querySelector?.(
        '[role="dialog"], [role="menu"], [role="listbox"], [role="tree"], [role="grid"]',
      )
      if (directOverlayDescendant instanceof Element && directOverlayDescendant !== anchor) {
        return directOverlayDescendant
      }

      let current: Element | null = node
      let best: Element | null = null

      while (current && current !== document.body) {
        const role = normalizeText(current.getAttribute('role'))
        const style = current instanceof HTMLElement ? window.getComputedStyle(current) : null
        const positioned = style ? ['absolute', 'fixed', 'sticky'].includes(style.position) : false
        const meaningfulChildCount = collectElements(current).length

        if (
          role === 'dialog' ||
          role === 'menu' ||
          role === 'listbox' ||
          role === 'tree' ||
          role === 'grid' ||
          positioned ||
          meaningfulChildCount > 1
        ) {
          best = current
        }

        if (current === anchor || current.contains(anchor)) {
          break
        }

        current = current.parentElement
      }

      return best ?? (node instanceof HTMLElement ? node : anchor)
    }

    function classifyPrimaryEffect(regions: ObservedRegionPayload[], navigationChanged: boolean) {
      if (navigationChanged) {
        return 'navigation' as const
      }

      if (regions.some((region) => ['dialog', 'menu', 'listbox', 'tree', 'grid'].includes(region.role ?? ''))) {
        return 'overlay' as const
      }

      if (regions.length > 0) {
        return 'content-update' as const
      }

      return 'no-visible-change' as const
    }

    function dedupeRegionRoots(roots: Element[], anchor: Element) {
      const filtered = roots.filter(
        (root, index) =>
          !roots.some((other, otherIndex) => otherIndex !== index && root.contains(other) && other !== root),
      )

      const nonAnchorRoots = filtered.filter((root) => root !== anchor)
      return nonAnchorRoots.length > 0 ? nonAnchorRoots : filtered
    }

    return {
      isVisible,
      summarizeMeaningfulNode,
      collectMeaningfulElements,
      isMeaningfulElementSelf,
      indexTree,
      diffIndexes,
      findRegionRoot,
      classifyPrimaryEffect,
      dedupeRegionRoots,
    }
  }

  function getObservationState() {
    return (window as typeof window & { [stateKey]?: ObservationState })[stateKey]
  }

  function setObservationState(state: ObservationState) {
    ;(window as typeof window & { [stateKey]?: ObservationState })[stateKey] = state
  }

  function buildObservedRegions(
    roots: Element[],
    beforeIndex: Map<string, MeaningfulNodeSnapshot>,
    summarizeMeaningfulNode: (element: Element) => MeaningfulNodeSnapshot,
    helpers: ReturnType<typeof createObservationDomHelpers>,
    maxRegions: number,
  ): ObservedRegionPayload[] {
    const regions = new Map<string, ObservedRegionPayload>()

    for (const root of roots) {
      const tree = summarizeMeaningfulNode(root)
      const afterIndex = helpers.indexTree(tree)
      const beforeLocal = new Map<string, MeaningfulNodeSnapshot>()

      for (const key of afterIndex.keys()) {
        const previous = beforeIndex.get(key)
        if (previous) {
          beforeLocal.set(key, previous)
        }
      }

      for (const changedNode of helpers.diffIndexes(beforeLocal, afterIndex)) {
        const node = changedNode.after ?? changedNode.before
        if (!node) {
          continue
        }

        const existing = regions.get(node.key)
        if (existing) {
          const duplicate = existing.changedNodes.some(
            (entry) => entry.key === changedNode.key && entry.change === changedNode.change,
          )

          if (!duplicate) {
            existing.changedNodes.push(changedNode)
          }
          continue
        }

        regions.set(node.key, {
          key: node.key,
          role: node.role,
          locator: node.locator,
          confidence: 1,
          reasons: ['mutation-observed'],
          changedNodes: [changedNode],
        })
      }
    }

    return Array.from(regions.values()).slice(0, maxRegions)
  }

  if (operation === 'start') {
    const startPayload = payload as ClickObserveStartCommandPayload
    const options = {
      ...getDefaultObservationOptions(),
      ...(startPayload.observe ?? {}),
    }
    const helpers = createObservationDomHelpers(options)

    const existing = getObservationState()
    existing?.cleanup()

    const anchor = startPayload.selector ? document.querySelector(startPayload.selector) : null
    if (!anchor) {
      return {
        started: false,
        tabId: startPayload.tabId ?? 0,
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
        delete (window as typeof window & { [stateKey]?: unknown })[stateKey]
      },
    })

    return {
      started: true,
      tabId: startPayload.tabId ?? 0,
    }
  }

  if (operation === 'finish') {
    const finishPayload = payload as ClickObserveFinishCommandPayload
    const observationState = getObservationState()
    const fallbackObservation = buildFallbackObservation()

    if (!observationState) {
      return {
        tabId: finishPayload.tabId ?? 0,
        observation: {
          ...fallbackObservation,
          meta: {
            ...fallbackObservation.meta,
            debugSource: 'page-finish-missing-state',
          },
        },
      }
    }

    const options = {
      ...observationState.options,
      ...(finishPayload.observe ?? {}),
    }
    const helpers = createObservationDomHelpers(options)
    let endedBy: ClickObserveFinishResultPayload['observation']['meta']['endedBy'] = 'no-change'

    return (async () => {
      try {
        if (finishPayload.awaitStability !== false) {
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
        )

        if (observationState.changedNodes.has(observationState.anchor) && !roots.includes(observationState.anchor)) {
          roots.unshift(observationState.anchor)
        }

        const beforeIndex = new Map(observationState.beforeEntries)
        const regions = buildObservedRegions(
          roots,
          beforeIndex,
          observationState.summarizeMeaningfulNode,
          helpers,
          options.maxRegions,
        )

        const activeElement =
          document.activeElement instanceof Element && observationState.isMeaningfulElementSelf(document.activeElement)
            ? observationState.summarizeMeaningfulNode(document.activeElement)
            : undefined

        return {
          tabId: finishPayload.tabId ?? 0,
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
    })()
  }

  const observePayload = payload as ClickCommandPayload
  const options = {
    ...getDefaultObservationOptions(),
    ...(observePayload.observe ?? {}),
  }
  const helpers = createObservationDomHelpers(options)
  const anchor = observePayload.selector ? document.querySelector(observePayload.selector) : null
  const initialUrl = window.location.href

  if (!anchor) {
    return {
      clicked: false,
      tabId: observePayload.tabId ?? 0,
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

  return (async () => {
    const beforeIndex = new Map<string, MeaningfulNodeSnapshot>()
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

    let endedBy: ClickCommandResultPayload['observation']['meta']['endedBy'] = 'max-timeout'
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
    )

    if (changedNodes.has(anchor) && !roots.includes(anchor)) {
      roots.unshift(anchor)
    }

    const regions = buildObservedRegions(roots, beforeIndex, helpers.summarizeMeaningfulNode, helpers, options.maxRegions)

    const activeElement =
      document.activeElement instanceof Element && helpers.isMeaningfulElementSelf(document.activeElement)
        ? helpers.summarizeMeaningfulNode(document.activeElement)
        : undefined

    return {
      clicked: true,
      tabId: observePayload.tabId ?? 0,
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
  })()
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

function buildObservedRegions(
  roots: Element[],
  beforeIndex: Map<string, MeaningfulNodeSnapshot>,
  summarizeMeaningfulNode: (element: Element) => MeaningfulNodeSnapshot,
  helpers: ReturnType<typeof createObservationDomHelpers>,
  maxRegions: number,
): ObservedRegionPayload[] {
  const regions = new Map<string, ObservedRegionPayload>()

  for (const root of roots) {
    const tree = summarizeMeaningfulNode(root)
    const afterIndex = helpers.indexTree(tree)
    const beforeLocal = new Map<string, MeaningfulNodeSnapshot>()

    for (const key of afterIndex.keys()) {
      const previous = beforeIndex.get(key)
      if (previous) {
        beforeLocal.set(key, previous)
      }
    }

    for (const changedNode of helpers.diffIndexes(beforeLocal, afterIndex)) {
      const node = changedNode.after ?? changedNode.before
      if (!node) {
        continue
      }

      const existing = regions.get(node.key)
      if (existing) {
        const duplicate = existing.changedNodes.some(
          (entry) => entry.key === changedNode.key && entry.change === changedNode.change,
        )

        if (!duplicate) {
          existing.changedNodes.push(changedNode)
        }
        continue
      }

      regions.set(node.key, {
        key: node.key,
        role: node.role,
        locator: node.locator,
        confidence: 1,
        reasons: ['mutation-observed'],
        changedNodes: [changedNode],
      })
    }
  }

  return Array.from(regions.values()).slice(0, maxRegions)
}

type ObservationHelpers = ReturnType<typeof createObservationDomHelpers>
type ObservationEndedBy = PostClickObservationPayload['meta']['endedBy']

function collectBeforeEntries(helpers: ObservationHelpers): Array<[string, MeaningfulNodeSnapshot]> {
  return helpers.collectMeaningfulElements(document.body).map((element) => {
    const snapshot = helpers.summarizeMeaningfulNode(element)
    return [snapshot.key, snapshot] as [string, MeaningfulNodeSnapshot]
  })
}

function createObservationRuntime(
  anchor: Element,
  helpers: ObservationHelpers,
  options: ObservationState['options'],
  markChildListTarget: boolean,
): ObservationState {
  const beforeEntries = collectBeforeEntries(helpers)
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

      if (markChildListTarget && mutation.type === 'childList' && mutation.target instanceof Element) {
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

  return {
    anchor,
    beforeEntries,
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
  }
}

async function waitForObservationToSettle(
  observationState: ObservationState,
  options: ObservationState['options'],
  awaitStability: boolean,
): Promise<ObservationEndedBy> {
  if (!awaitStability) {
    return 'no-change'
  }

  while (true) {
    const now = Date.now()
    const elapsed = now - observationState.startedAt
    const navigationChanged = window.location.href !== observationState.initialUrl

    if (navigationChanged) {
      return 'navigation'
    }

    if (elapsed >= options.maxObserveMs) {
      return 'max-timeout'
    }

    if (elapsed >= options.minObserveMs) {
      const domIdle = now - observationState.getLastMeaningfulMutationAt() >= options.stableWindowMs
      const networkIdle =
        observationState.getPendingRequests() === 0 &&
        now - observationState.getLastNetworkActivityAt() >= options.stableWindowMs
      const focusIdle = now - observationState.getLastFocusChangeAt() >= options.stableWindowMs

      if (domIdle && networkIdle && focusIdle) {
        return observationState.getMeaningfulMutations() > 0 ? 'stabilized' : 'no-change'
      }
    }

    await new Promise((resolve) => window.setTimeout(resolve, 25))
  }
}

function resolveObservedRoots(observationState: ObservationState, helpers: ObservationHelpers) {
  const roots = helpers.dedupeRegionRoots(
    Array.from(observationState.changedNodes)
      .map((node) => helpers.findRegionRoot(node, observationState.anchor, observationState.collectMeaningfulElements))
      .filter((node, index, list): node is Element => Boolean(node) && list.indexOf(node) === index),
    observationState.anchor,
  )

  if (observationState.changedNodes.has(observationState.anchor) && !roots.includes(observationState.anchor)) {
    roots.unshift(observationState.anchor)
  }

  return roots
}

function buildObservationPayload(
  observationState: ObservationState,
  helpers: ObservationHelpers,
  maxRegions: number,
  endedBy: ObservationEndedBy,
): PostClickObservationPayload {
  const roots = resolveObservedRoots(observationState, helpers)
  const beforeIndex = new Map(observationState.beforeEntries)
  const regions = buildObservedRegions(
    roots,
    beforeIndex,
    observationState.summarizeMeaningfulNode,
    helpers,
    maxRegions,
  )

  const activeElement =
    document.activeElement instanceof Element && observationState.isMeaningfulElementSelf(document.activeElement)
      ? observationState.summarizeMeaningfulNode(document.activeElement)
      : undefined

  return {
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
  }
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

  setObservationState(createObservationRuntime(anchor, helpers, options, false))

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
      observation: {
        ...fallbackObservation,
        meta: {
          ...fallbackObservation.meta,
          debugSource: 'page-finish-missing-state',
        },
      },
    }
  }

  const options = {
    ...observationState.options,
    ...(payload.observe ?? {}),
  }
  const helpers = createObservationDomHelpers(options)

  try {
    const endedBy = await waitForObservationToSettle(observationState, options, payload.awaitStability !== false)

    return {
      tabId: payload.tabId ?? 0,
      observation: buildObservationPayload(observationState, helpers, options.maxRegions, endedBy),
    }
  } finally {
    observationState.cleanup()
  }
}

export async function observeClickAction(
  payload: ClickCommandPayload,
): Promise<ClickCommandResultPayload> {
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
  const observationState = createObservationRuntime(anchor, helpers, options, true)

  ;(anchor as HTMLElement).click()

  try {
    const endedBy = await waitForObservationToSettle(observationState, options, true)

    return {
      clicked: true,
      tabId: payload.tabId ?? 0,
      observation: buildObservationPayload(observationState, helpers, options.maxRegions, endedBy),
    }
  } finally {
    observationState.cleanup()
  }
}
