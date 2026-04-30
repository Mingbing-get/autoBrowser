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
  collectMeaningfulElements: (root: Element) => Element[]
  isMeaningfulElementSelf: (element: Element) => boolean
  cleanup: () => void
}

export function getDefaultObservationOptions(): ObservationOptions {
  return {
    minObserveMs: 180,
    maxObserveMs: 4000,
    stableWindowMs: 300,
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

      nodes.push(...collectMeaningfulChildren(child))
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

      elements.push(...collectMeaningfulElements(child))
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
    collectMeaningfulElements,
    indexTree,
    diffIndexes,
    findRegionRoot,
    classifyPrimaryEffect,
    dedupeRegionRoots,
  }
}
