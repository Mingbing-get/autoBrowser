import type { MeaningfulNodeSnapshot, ObservedRegionPayload, PostClickObservationPayload } from '@autobrowser/shared'

export const CLICK_OBSERVATION_STATE_KEY = '__autobrowserClickObserveState__'

export type ObservationOptions = {
  minObserveMs: number
  maxObserveMs: number
  stableWindowMs: number
  maxRegions: number
  maxItemsPerRegion: number
  maxTextLength: number
}

export type ObservationState = {
  anchor: Element
  beforeEntries: Array<[string, MeaningfulNodeSnapshot]>
  beforeAnyVisibilityEntries: Array<[string, MeaningfulNodeSnapshot]>
  changedNodes: Set<Element>
  options: ObservationOptions
  startedAt: number
  initialUrl: string
  getPendingRequests: () => number
  getNetworkEvents: () => number
  getMeaningfulMutations: () => number
  getLastMeaningfulMutationAt: () => number
  getLastNetworkActivityAt: () => number
  getLastFocusChangeAt: () => number
  summarizeMeaningfulNode: (element: Element) => MeaningfulNodeSnapshot
  summarizeMeaningfulNodeAnyVisibility: (element: Element) => MeaningfulNodeSnapshot
  collectMeaningfulElements: (root: Element) => Element[]
  collectMeaningfulElementsAnyVisibility: (root: Element) => Element[]
  isMeaningfulElementSelf: (element: Element) => boolean
  cleanup: () => void
}

export function getDefaultObservationOptions(): ObservationOptions {
  return {
    minObserveMs: 180,
    maxObserveMs: 10000,
    stableWindowMs: 1000,
    maxRegions: 8,
    maxItemsPerRegion: 40,
    maxTextLength: 160,
  }
}

export function buildFallbackObservation(): PostClickObservationPayload {
  const href =
    typeof globalThis.window !== 'undefined' && typeof globalThis.window.location?.href === 'string'
      ? globalThis.window.location.href
      : ''

  return {
    primaryEffect: 'no-visible-change',
    regions: [],
    navigation: {
      from: href,
      to: href,
      changed: false,
    },
    meta: {
      durationMs: 0,
      endedBy: 'no-change',
      networkEvents: 0,
      meaningfulMutations: 0,
      debugSource: typeof globalThis.window !== 'undefined' ? 'page-fallback' : 'extension-fallback',
    },
  }
}

export function createObservationDomHelpers(options: ObservationOptions) {
  type TraversalCache = {
    visible: WeakMap<Element, boolean>
    directText: WeakMap<Element, string>
    state: WeakMap<Element, ReturnType<typeof collectState> | null>
    meaningfulVisible: WeakMap<Element, boolean>
    meaningfulAnyVisibility: WeakMap<Element, boolean>
    promotedVisible: WeakMap<Element, number>
    promotedAnyVisibility: WeakMap<Element, number>
  }

  function normalizeText(value: string | null | undefined) {
    return (value ?? '').replace(/\s+/g, ' ').trim()
  }

  function createTraversalCache(): TraversalCache {
    return {
      visible: new WeakMap<Element, boolean>(),
      directText: new WeakMap<Element, string>(),
      state: new WeakMap<Element, ReturnType<typeof collectState> | null>(),
      meaningfulVisible: new WeakMap<Element, boolean>(),
      meaningfulAnyVisibility: new WeakMap<Element, boolean>(),
      promotedVisible: new WeakMap<Element, number>(),
      promotedAnyVisibility: new WeakMap<Element, number>(),
    }
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

  function isVisibleCached(element: Element, cache: TraversalCache) {
    if (cache.visible.has(element)) {
      return cache.visible.get(element) ?? false
    }

    const visible = isVisible(element)
    cache.visible.set(element, visible)
    return visible
  }

  function directTextCached(element: Element, cache: TraversalCache) {
    if (cache.directText.has(element)) {
      return cache.directText.get(element) ?? ''
    }

    const text = directText(element)
    cache.directText.set(element, text)
    return text
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

  function collectStateCached(element: Element, cache: TraversalCache) {
    if (cache.state.has(element)) {
      return cache.state.get(element) ?? undefined
    }

    const state = collectState(element)
    cache.state.set(element, state ?? null)
    return state
  }

  function countPromotedMeaningfulChildren(
    root: Element,
    limit = 2,
    includeInvisible = false,
    cache = createTraversalCache(),
  ) {
    const promotedCache = includeInvisible ? cache.promotedAnyVisibility : cache.promotedVisible
    if (promotedCache.has(root)) {
      return Math.min(promotedCache.get(root) ?? 0, limit)
    }

    let count = 0

    for (const child of Array.from(root.children) as Element[]) {
      if (!includeInvisible && !isVisibleCached(child, cache)) {
        continue
      }

      if (isMeaningfulElementSelfInternal(child, includeInvisible, cache)) {
        count += 1
      } else if (!isMeaningfulLeafElement(child)) {
        count += countPromotedMeaningfulChildren(child, 2, includeInvisible, cache)
      }

      if (count >= 2) {
        promotedCache.set(root, 2)
        return Math.min(2, limit)
      }
    }

    promotedCache.set(root, count)
    return Math.min(count, limit)
  }

  function isMeaningfulElementSelfInternal(
    element: Element,
    includeInvisible: boolean,
    cache = createTraversalCache(),
  ) {
    const meaningfulCache = includeInvisible ? cache.meaningfulAnyVisibility : cache.meaningfulVisible
    if (meaningfulCache.has(element)) {
      return meaningfulCache.get(element) ?? false
    }

    if (!includeInvisible && !isVisibleCached(element, cache)) {
      meaningfulCache.set(element, false)
      return false
    }

    const tag = element.tagName.toLowerCase()
    if (['script', 'style', 'noscript', 'template'].includes(tag)) {
      meaningfulCache.set(element, false)
      return false
    }

    if (isMeaningfulLeafElement(element)) {
      meaningfulCache.set(element, true)
      return true
    }

    const ownText = directTextCached(element, cache)
    if (ownText) {
      meaningfulCache.set(element, true)
      return true
    }

    if (isClickable(element) || isEditable(element)) {
      meaningfulCache.set(element, true)
      return true
    }

    const state = collectStateCached(element, cache)
    if (state && Object.keys(state).some((key) => key !== 'clickable' && key !== 'editable')) {
      meaningfulCache.set(element, true)
      return true
    }

    if (element.hasAttribute('data-testid')) {
      meaningfulCache.set(element, true)
      return true
    }

    const promotedChildCount = countPromotedMeaningfulChildren(element, 2, includeInvisible, cache)
    let meaningful = false

    if (isSemanticTag(tag)) {
      if (['main', 'nav', 'header', 'footer', 'section', 'article', 'aside', 'form', 'dialog', 'ul', 'ol'].includes(tag)) {
        meaningful = promotedChildCount > 1
      } else {
        meaningful = true
      }
    } else if (element.hasAttribute('role')) {
      meaningful = promotedChildCount > 1
    } else if (includeInvisible) {
      meaningful = promotedChildCount > 0
    }

    meaningfulCache.set(element, meaningful)
    return meaningful
  }

  function isMeaningfulElementSelf(element: Element) {
    return isMeaningfulElementSelfInternal(element, false)
  }

  function truncateText(value: string, limit: number) {
    return value.length <= limit ? value : `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`
  }

  function summarizeMeaningfulNodeInternal(
    element: Element,
    includeInvisible: boolean,
    cache = createTraversalCache(),
  ): MeaningfulNodeSnapshot {
    const role = normalizeText(element.getAttribute('role')) || undefined
    const text = truncateText(directTextCached(element, cache), options.maxTextLength)
    const locator = buildLocator(element)
    const key = locator?.preferred ?? `${role ?? element.tagName.toLowerCase()}::${text}`

    if (isMeaningfulLeafElement(element)) {
      const attrs = collectAttrs(element)
      const state = collectStateCached(element, cache)
      return {
        key,
        tag: element.tagName.toLowerCase(),
        role,
        ...(text ? { text } : {}),
        ...(attrs ? { attrs } : {}),
        ...(state ? { state } : {}),
        ...(locator ? { locator } : {}),
        visible: isVisibleCached(element, cache),
      }
    }

    const children: MeaningfulNodeSnapshot[] = []
    const seenChildKeys = new Set<string>()

    for (const child of Array.from(element.children) as Element[]) {
      if (!includeInvisible && !isVisibleCached(child, cache)) {
        continue
      }

      if (isMeaningfulElementSelfInternal(child, includeInvisible, cache)) {
        const childSummary = summarizeMeaningfulNodeInternal(child, includeInvisible, cache)
        if (!seenChildKeys.has(childSummary.key)) {
          seenChildKeys.add(childSummary.key)
          children.push(childSummary)
        }
        continue
      }

      for (const descendant of collectMeaningfulChildrenInternal(child, includeInvisible, cache)) {
        if (!seenChildKeys.has(descendant.key)) {
          seenChildKeys.add(descendant.key)
          children.push(descendant)
        }
      }
    }

    const attrs = collectAttrs(element)
    const state = collectStateCached(element, cache)
    return {
      key,
      tag: element.tagName.toLowerCase(),
      role,
      ...(text ? { text } : {}),
      ...(attrs ? { attrs } : {}),
      ...(state ? { state } : {}),
      ...(locator ? { locator } : {}),
      visible: isVisibleCached(element, cache),
      ...(children.length > 0 ? { children: children.slice(0, options.maxItemsPerRegion) } : {}),
    }
  }

  function summarizeMeaningfulNode(element: Element): MeaningfulNodeSnapshot {
    return summarizeMeaningfulNodeInternal(element, false, createTraversalCache())
  }

  function summarizeMeaningfulNodeAnyVisibility(element: Element): MeaningfulNodeSnapshot {
    return summarizeMeaningfulNodeInternal(element, true, createTraversalCache())
  }

  function collectMeaningfulChildrenInternal(
    root: Element,
    includeInvisible: boolean,
    cache = createTraversalCache(),
  ) {
    const nodes: MeaningfulNodeSnapshot[] = []
    for (const child of Array.from(root.children) as Element[]) {
      if (!includeInvisible && !isVisibleCached(child, cache)) {
        continue
      }

      if (isMeaningfulElementSelfInternal(child, includeInvisible, cache)) {
        nodes.push(summarizeMeaningfulNodeInternal(child, includeInvisible, cache))
        continue
      }

      if (!isMeaningfulLeafElement(child)) {
        nodes.push(...collectMeaningfulChildrenInternal(child, includeInvisible, cache))
      }
    }

    return nodes
  }

  function collectMeaningfulChildren(root: Element) {
    return collectMeaningfulChildrenInternal(root, false, createTraversalCache())
  }

  function collectMeaningfulElementsInternal(
    root: Element,
    includeInvisible: boolean,
    cache = createTraversalCache(),
  ) {
    const elements: Element[] = []
    for (const child of Array.from(root.children) as Element[]) {
      if (!includeInvisible && !isVisibleCached(child, cache)) {
        continue
      }

      if (isMeaningfulElementSelfInternal(child, includeInvisible, cache)) {
        elements.push(child)
      }

      if (!isMeaningfulLeafElement(child)) {
        elements.push(...collectMeaningfulElementsInternal(child, includeInvisible, cache))
      }
    }

    return elements
  }

  function collectMeaningfulElements(root: Element) {
    return collectMeaningfulElementsInternal(root, false, createTraversalCache())
  }

  function collectMeaningfulElementsAnyVisibility(root: Element) {
    return collectMeaningfulElementsInternal(root, true, createTraversalCache())
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

  function collectDescendantKeys(node: MeaningfulNodeSnapshot): string[] {
    const keys: string[] = []

    for (const child of node.children ?? []) {
      keys.push(child.key, ...collectDescendantKeys(child))
    }

    return keys
  }

  function diffIndexes(
    beforeVisible: Map<string, MeaningfulNodeSnapshot>,
    beforeAnyVisibility: Map<string, MeaningfulNodeSnapshot>,
    after: Map<string, MeaningfulNodeSnapshot>,
  ) {
    const changes: ObservedRegionPayload['changedNodes'] = []
    const skippedDescendants = new Set<string>()

    for (const [key, nextNode] of after.entries()) {
      if (skippedDescendants.has(key)) {
        continue
      }

      const previousAnyVisibility = beforeAnyVisibility.get(key)
      if (!previousAnyVisibility) {
        changes.push({
          key,
          change: 'added',
          after: nextNode,
        })
        continue
      }

      if (previousAnyVisibility.visible === false && nextNode.visible === true) {
        changes.push({
          key,
          change: 'became-visible',
          before: previousAnyVisibility,
          after: nextNode,
        })

        for (const descendantKey of collectDescendantKeys(nextNode)) {
          skippedDescendants.add(descendantKey)
        }
        continue
      }

      const previous = beforeVisible.get(key) ?? previousAnyVisibility
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

    for (const [key, previous] of beforeVisible.entries()) {
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
    const directOverlayDescendant = node.querySelector?.('[role="dialog"], [role="menu"], [role="listbox"], [role="tree"], [role="grid"]')
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
    normalizeText,
    isVisible,
    isClickable,
    isEditable,
    isDisabled,
    isMeaningfulElementSelf,
    summarizeMeaningfulNode,
    summarizeMeaningfulNodeAnyVisibility,
    collectMeaningfulChildren,
    collectMeaningfulElements,
    collectMeaningfulElementsAnyVisibility,
    indexTree,
    diffIndexes,
    findRegionRoot,
    classifyPrimaryEffect,
    dedupeRegionRoots,
  }
}

export function pruneMeaningfulSnapshotToChangedBranch(
  snapshot: MeaningfulNodeSnapshot | undefined,
  changedKeys: ReadonlySet<string>,
): MeaningfulNodeSnapshot | undefined {
  function collectChangedSnapshots(node: MeaningfulNodeSnapshot | undefined): MeaningfulNodeSnapshot[] {
    if (!node) {
      return []
    }

    const children = (node.children ?? []).flatMap((child) => collectChangedSnapshots(child))

    if (!changedKeys.has(node.key)) {
      return children
    }

    if (children.length === 0) {
      const { children: _children, ...rest } = node
      return [rest]
    }

    return [
      {
        ...node,
        children,
      },
    ]
  }

  return collectChangedSnapshots(snapshot)[0]
}
