import type {
  DomRectPayload,
  PageSummaryPayload,
  PageTextPayload,
  QueryResultPayload,
  SearchResultPayload,
} from '@autobrowser/shared'
import { waitForTabComplete } from './tabs.js'

type DomInspectionArgs = {
  mode: 'query' | 'search' | 'summary' | 'text' | 'rect'
  selector?: string
  text?: string
}

export async function querySelectorInTab(tabId: number, selector: string): Promise<QueryResultPayload> {
  const [result] = await executeInspectionScript(tabId, {
    mode: 'query',
    selector,
  })

  return (result?.result as QueryResultPayload | undefined) ?? { found: false }
}

export async function summarizePageInTab(tabId: number): Promise<PageSummaryPayload> {
  const [result] = await executeInspectionScript(tabId, {
    mode: 'summary',
  })

  return (
    (result?.result as PageSummaryPayload | undefined) ?? {
      title: '',
      url: '',
      descendants: [],
      meta: {
        textLimit: 120,
        truncated: false,
      },
    }
  )
}

export async function searchTextInTab(tabId: number, text: string): Promise<SearchResultPayload> {
  const [result] = await executeInspectionScript(tabId, {
    mode: 'search',
    text,
  })

  return (
    (result?.result as SearchResultPayload | undefined) ?? {
      found: false,
      matches: [],
      meta: {
        query: text,
        limit: 20,
        totalMatches: 0,
        truncated: false,
      },
    }
  )
}

export async function textContentInTab(tabId: number, selector: string): Promise<PageTextPayload> {
  const [result] = await executeInspectionScript(tabId, {
    mode: 'text',
    selector,
  })

  const payload = result?.result as PageTextPayload | undefined
  if (!payload) {
    return { found: false }
  }

  if (payload.found === undefined) {
    return payload.text ? { found: true, text: payload.text } : { found: false }
  }

  return payload
}

export async function getElementRectInTab(tabId: number, selector: string): Promise<DomRectPayload> {
  const [result] = await executeInspectionScript(tabId, {
    mode: 'rect',
    selector,
  })

  return (result?.result as DomRectPayload | undefined) ?? { found: false }
}

export async function startClickMappingInTab(tabId: number) {
  const [scriptResults, zoom] = await Promise.all([
    chrome.scripting.executeScript({
      target: { tabId },
      func: startClickMappingOverlay,
      args: [],
    }),
    getTabZoom(tabId),
  ])

  const [result] = scriptResults
  const payload = (result?.result as
    | {
        rect: {
          left: number
          top: number
          width: number
          height: number
        }
        window: {
          screenLeft: number
          screenTop: number
          innerWidth: number
          innerHeight: number
          outerWidth: number
          outerHeight: number
          devicePixelRatio: number
        }
      }
    | undefined) ?? {
    rect: {
      left: 0,
      top: 0,
      width: 0,
      height: 0,
    },
    window: {
      screenLeft: 0,
      screenTop: 0,
      innerWidth: 0,
      innerHeight: 0,
      outerWidth: 0,
      outerHeight: 0,
      devicePixelRatio: 1,
    },
  }

  return {
    ...payload,
    zoom: typeof zoom === 'number' ? zoom : 1,
  }
}

async function getTabZoom(tabId: number) {
  const tabsApi = chrome.tabs as typeof chrome.tabs & {
    getZoom?: (tabId: number, callback: (value: number) => void) => void
  }

  if (typeof tabsApi.getZoom !== 'function') {
    return 1
  }

  return await new Promise<number>((resolve) => {
    tabsApi.getZoom?.(tabId, (value: number) => {
      resolve(typeof value === 'number' ? value : 1)
    })
  })
}

export async function finishClickMappingInTab(tabId: number) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: finishClickMappingOverlay,
    args: [],
  })

  return (
    (result?.result as
      | {
          points: Array<{
            x: number
            y: number
          }>
        }
      | undefined) ?? {
      points: [],
    }
  )
}

async function executeInspectionScript(tabId: number, args: DomInspectionArgs) {
  try {
    return await chrome.scripting.executeScript({
      target: { tabId },
      func: inspectDom as (...args: unknown[]) => unknown,
      args: [args],
    })
  } catch (error) {
    if (!isRetryableFrameError(error)) {
      throw error
    }

    await waitForTabComplete(tabId, 4000)

    return await chrome.scripting.executeScript({
      target: { tabId },
      func: inspectDom as (...args: unknown[]) => unknown,
      args: [args],
    })
  }
}

function isRetryableFrameError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return message.includes('frame with id 0 was removed')
}

export function inspectDom(args: DomInspectionArgs) {
  const LIMITS = {
    ancestorLimit: 3,
    searchMatchLimit: 20,
    siblingLimit: 4,
    textLimit: 120,
    summaryChildLimit: 4,
    landmarkLimit: 6,
    headingLimit: 6,
    formLimit: 3,
    formFieldLimit: 5,
    formActionLimit: 3,
    interactiveLimit: 8,
  } as const

  const ATTR_WHITELIST = [
    'id',
    'name',
    'type',
    'href',
    'title',
    'alt',
    'placeholder',
    'role',
    'aria-label',
    'aria-labelledby',
    'aria-describedby',
    'data-testid',
  ] as const

  function normalizeText(value: string | null | undefined) {
    return (value ?? '').replace(/\s+/g, ' ').trim()
  }

  function toRectPayload(rect: DOMRect | DOMRectReadOnly) {
    return {
      x: rect.x,
      y: rect.y,
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    }
  }

  function fullInnerText(element: HTMLElement) {
    return normalizeText(element.innerText || element.textContent || '')
  }

  function truncateText(value: string, limit: number) {
    if (value.length <= limit) {
      return {
        text: value,
        meta: {},
      }
    }

    return {
      text: `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`,
      meta: {
        textTruncated: true,
        originalTextLength: value.length,
      },
    }
  }

  function cssEscape(value: string) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value)
    }

    return value.replace(/["\\.#:[\]()]/g, '\\$&')
  }

  function toRecord(entries: Array<[string, string]>) {
    if (entries.length === 0) {
      return undefined
    }

    return Object.fromEntries(entries)
  }

  function isSensitiveInput(element: Element) {
    return element instanceof HTMLInputElement && ['password', 'hidden', 'file'].includes(element.type.toLowerCase())
  }

  function isEditable(element: Element) {
    return (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement ||
      (element instanceof HTMLElement && element.isContentEditable)
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
      role === 'button' || role === 'link' || role === 'tab' || role === 'menuitem' || element.hasAttribute('onclick')
    )
  }

  function isDisabled(element: Element) {
    return (
      (element instanceof HTMLButtonElement ||
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLOptGroupElement ||
        element instanceof HTMLOptionElement) &&
      element.disabled
    )
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

  function canScrollInAxis(element: HTMLElement, axis: 'x' | 'y') {
    const overflow = window.getComputedStyle(element)[axis === 'x' ? 'overflowX' : 'overflowY']
    const canOverflow = overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay'

    if (!canOverflow) {
      return false
    }

    return axis === 'x' ? element.scrollWidth > element.clientWidth : element.scrollHeight > element.clientHeight
  }

  function isScrollable(element: HTMLElement) {
    return canScrollInAxis(element, 'x') || canScrollInAxis(element, 'y')
  }

  function collectScrollableAncestors(element: HTMLElement) {
    const ancestors: Array<NonNullable<DomRectPayload['scrollableAncestors']>[number]> = []
    let current = element.parentElement

    while (current) {
      const isRootScroller =
        current === document.scrollingElement || current === document.documentElement || current === document.body

      if (isScrollable(current)) {
        ancestors.push({
          tag: current.tagName.toLowerCase(),
          ...(current.id ? { id: current.id } : {}),
          isRootScroller,
          rect: toRectPayload(current.getBoundingClientRect()),
          scrollLeft: current.scrollLeft,
          scrollTop: current.scrollTop,
          scrollWidth: current.scrollWidth,
          scrollHeight: current.scrollHeight,
          clientWidth: current.clientWidth,
          clientHeight: current.clientHeight,
        })
      }

      current = current.parentElement
    }

    return ancestors
  }

  function canTraverseChildren(element: Element) {
    if (!(element instanceof HTMLElement)) {
      return true
    }

    const style = window.getComputedStyle(element)

    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && !element.hidden
  }

  function directText(element: Element) {
    const text = Array.from(element.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? '')
      .join(' ')

    return normalizeText(text)
  }

  function controlLabel(element: Element) {
    if (
      !(element instanceof HTMLInputElement) &&
      !(element instanceof HTMLTextAreaElement) &&
      !(element instanceof HTMLSelectElement)
    ) {
      return ''
    }

    return normalizeText(
      Array.from(element.labels ?? [])
        .map((label) => label.textContent ?? '')
        .join(' '),
    )
  }

  function elementText(element: Element, limit: number) {
    let rawText = ''

    if (!isSensitiveInput(element) && element instanceof HTMLInputElement) {
      rawText = normalizeText(element.value)
    } else if (element instanceof HTMLTextAreaElement) {
      rawText = normalizeText(element.value)
    } else {
      rawText = directText(element) || fullInnerText(element as HTMLElement)
    }

    if (!rawText) {
      return {
        text: undefined,
        meta: {},
      }
    }

    const truncated = truncateText(rawText, limit)
    return {
      text: truncated.text,
      meta: truncated.meta,
    }
  }

  function collectAttrs(element: Element) {
    const entries: Array<[string, string]> = []

    for (const attr of ATTR_WHITELIST) {
      const value = normalizeText(element.getAttribute(attr))
      if (value) {
        entries.push([attr, value])
      }
    }

    if (element instanceof HTMLInputElement && !isSensitiveInput(element)) {
      const value = normalizeText(element.value)
      if (value) {
        entries.push(['value', truncateText(value, LIMITS.textLimit).text])
      }
    }

    if (element instanceof HTMLTextAreaElement) {
      const value = normalizeText(element.value)
      if (value) {
        entries.push(['value', truncateText(value, LIMITS.textLimit).text])
      }
    }

    const label = controlLabel(element)
    if (label) {
      entries.push(['label', truncateText(label, LIMITS.textLimit).text])
    }

    return toRecord(entries)
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

      const siblings = (Array.from(parent.children) as Element[]).filter(
        (child: Element) => child.tagName.toLowerCase() === tag,
      )
      const index = siblings.indexOf(current) + 1
      segments.unshift(`${tag}:nth-of-type(${index})`)
      current = parent
    }

    return segments.join(' > ')
  }

  function buildLocator(element: Element) {
    const selectors: string[] = []
    const tag = element.tagName.toLowerCase()
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

    const uniqueSelectors = selectors.filter((selector, index) => selector && selectors.indexOf(selector) === index)
    const fallbacks = uniqueSelectors.slice(1)

    return uniqueSelectors.length > 0
      ? {
          preferred: uniqueSelectors[0],
          ...(fallbacks.length > 0 ? { fallbacks } : {}),
        }
      : undefined
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

  function collectSemanticChildren(element: Element) {
    const results: Element[] = []
    const seen = new Set<Element>()

    function visit(current: Element) {
      for (const child of Array.from(current.children) as Element[]) {
        if (seen.has(child)) {
          continue
        }

        seen.add(child)

        const tag = child.tagName.toLowerCase()
        if (['script', 'style', 'noscript', 'template'].includes(tag)) {
          continue
        }

        if (isMeaningfulElementSelf(child)) {
          results.push(child)
          continue
        }

        if (canTraverseChildren(child)) {
          visit(child)
        }
      }
    }

    visit(element)
    return results
  }

  function summarizeNode(
    element: Element,
    {
      depth,
      maxDepth,
      childLimit,
      textLimit,
      includeChildren,
    }: {
      depth: number
      maxDepth: number
      childLimit: number
      textLimit: number
      includeChildren: boolean
    },
  ): any {
    const tag = element.tagName.toLowerCase()
    const role = normalizeText(element.getAttribute('role')) || undefined
    const textInfo = elementText(element, textLimit)
    const textMeta = textInfo.meta as {
      textTruncated?: boolean
      originalTextLength?: number
    }
    const attrs = collectAttrs(element)
    const state = collectState(element)
    const locator = buildLocator(element)
    const meta: Record<string, number | boolean> = {}
    let children: any[] | undefined

    if (textMeta.textTruncated) {
      meta.textTruncated = true
    }

    if (typeof textMeta.originalTextLength === 'number') {
      meta.originalTextLength = textMeta.originalTextLength
    }

    if (includeChildren && depth < maxDepth) {
      const semanticChildren = collectSemanticChildren(element)
      const visibleChildren = semanticChildren.slice(0, childLimit)

      children = visibleChildren.map((child) =>
        summarizeNode(child, {
          depth: depth + 1,
          maxDepth,
          childLimit,
          textLimit,
          includeChildren: true,
        }),
      )

      if (semanticChildren.length > childLimit) {
        meta.childrenTruncated = true
        meta.hiddenChildrenCount = semanticChildren.length - childLimit
      }
    } else if (includeChildren) {
      const hiddenSemanticChildren = collectSemanticChildren(element)
      if (hiddenSemanticChildren.length > 0) {
        meta.childrenTruncated = true
        meta.hiddenChildrenCount = hiddenSemanticChildren.length
      }
    }

    return {
      tag,
      role,
      text: textInfo.text,
      attrs,
      state,
      locator,
      children: children?.length ? children : undefined,
      meta: Object.keys(meta).length > 0 ? meta : undefined,
    }
  }

  function summarizeAncestors(element: Element) {
    const ancestors: any[] = []
    let current = element.parentElement

    while (current && ancestors.length < LIMITS.ancestorLimit) {
      if (isMeaningfulElementSelf(current)) {
        ancestors.push(
          summarizeNode(current, {
            depth: 0,
            maxDepth: 0,
            childLimit: 0,
            textLimit: LIMITS.textLimit,
            includeChildren: false,
          }),
        )
      }

      current = current.parentElement
    }

    return ancestors
  }

  function summarizeSiblings(element: Element) {
    const parent = element.parentElement
    if (!parent) {
      return []
    }

    const meaningfulSiblings = (Array.from(parent.children) as Element[]).filter(isMeaningfulElementSelf)
    const selfIndex = meaningfulSiblings.indexOf(element)
    if (selfIndex === -1) {
      return []
    }

    const beforeCount = Math.floor(LIMITS.siblingLimit / 2)
    const afterCount = LIMITS.siblingLimit - beforeCount
    const before = meaningfulSiblings.slice(Math.max(0, selfIndex - beforeCount), selfIndex)
    const after = meaningfulSiblings.slice(selfIndex + 1, selfIndex + 1 + afterCount)

    return [...before, ...after].map((sibling) =>
      summarizeNode(sibling, {
        depth: 0,
        maxDepth: 0,
        childLimit: 0,
        textLimit: LIMITS.textLimit,
        includeChildren: false,
      }),
    )
  }

  function uniqueByPreferred<T extends { locator?: { preferred: string } }>(items: T[]) {
    const seen = new Set<string>()
    return items.filter((item) => {
      const key = item.locator?.preferred
      if (!key || seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })
  }

  function collectAllMeaningfulElements(root: Element) {
    const results: Element[] = []

    function visit(current: Element) {
      for (const child of Array.from(current.children) as Element[]) {
        const tag = child.tagName.toLowerCase()
        if (['script', 'style', 'noscript', 'template'].includes(tag)) {
          continue
        }

        if (isMeaningfulElementSelf(child)) {
          results.push(child)
        }

        if (canTraverseChildren(child)) {
          visit(child)
        }
      }
    }

    visit(root)
    return results
  }

  function fullSearchText(element: Element) {
    const parts: string[] = []
    const text = elementText(element, Number.MAX_SAFE_INTEGER).text
    if (text) {
      parts.push(text)
    }

    const attrs = collectAttrs(element)
    if (attrs) {
      parts.push(...Object.values(attrs))
    }

    return normalizeText(parts.join(' '))
  }

  function elementMatchesSearch(element: Element, normalizedNeedle: string) {
    return fullSearchText(element).toLowerCase().includes(normalizedNeedle)
  }

  function shouldKeepSearchMatch(element: Element, normalizedNeedle: string) {
    let current = element.parentElement
    while (current) {
      if (
        elementMatchesSearch(current, normalizedNeedle) &&
        (isClickable(current) || isEditable(current)) &&
        !isClickable(element) &&
        !isEditable(element)
      ) {
        return false
      }

      current = current.parentElement
    }

    const descendants = collectSemanticChildren(element)
    const hasMatchingDescendant = descendants.some((child) => elementMatchesSearch(child, normalizedNeedle))

    if (!hasMatchingDescendant) {
      return true
    }

    return isClickable(element) || isEditable(element)
  }

  if (args.mode === 'query') {
    const element = args.selector ? document.querySelector(args.selector) : null
    if (!element) {
      return {
        found: false,
      }
    }

    const descendants = collectSemanticChildren(element)
    const children = descendants.map((child) =>
      summarizeNode(child, {
        depth: 0,
        maxDepth: 0,
        childLimit: 0,
        textLimit: LIMITS.textLimit,
        includeChildren: false,
      }),
    )
    const selfSummary = summarizeNode(element, {
      depth: 0,
      maxDepth: 0,
      childLimit: 0,
      textLimit: LIMITS.textLimit,
      includeChildren: false,
    })
    const self = {
      ...selfSummary,
      children: children.length > 0 ? children : undefined,
    }
    const truncated = Boolean(
      self.meta?.textTruncated || self.children?.some((child: any) => child.meta?.textTruncated),
    )

    return {
      found: true,
      self,
      context: {
        ancestors: summarizeAncestors(element),
        siblings: summarizeSiblings(element),
      },
      meta: {
        siblingLimit: LIMITS.siblingLimit,
        textLimit: LIMITS.textLimit,
        truncated,
      },
    }
  }

  if (args.mode === 'text') {
    const element = args.selector ? document.querySelector(args.selector) : null
    if (!(element instanceof HTMLElement)) {
      return {
        found: false,
      }
    }

    return {
      found: true,
      text: fullInnerText(element),
    }
  }

  if (args.mode === 'rect') {
    const element = args.selector ? document.querySelector(args.selector) : null
    if (!(element instanceof HTMLElement)) {
      return {
        found: false,
      }
    }

    const rect = element.getBoundingClientRect()

    return {
      found: true,
      viewport: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      },
      rect: {
        ...toRectPayload(rect),
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
      },
      scrollableAncestors: collectScrollableAncestors(element),
    }
  }

  if (args.mode === 'search') {
    const query = normalizeText(args.text)
    if (!query) {
      return {
        found: false,
        matches: [],
        meta: {
          query: '',
          limit: LIMITS.searchMatchLimit,
          totalMatches: 0,
          truncated: false,
        },
      }
    }

    const normalizedNeedle = query.toLowerCase()
    const semanticMatches = uniqueByPreferred(
      collectAllMeaningfulElements(document.body)
        .filter((element) => elementMatchesSearch(element, normalizedNeedle))
        .filter((element) => shouldKeepSearchMatch(element, normalizedNeedle))
        .map((element) => {
          const summary = summarizeNode(element, {
            depth: 0,
            maxDepth: 0,
            childLimit: 0,
            textLimit: LIMITS.textLimit,
            includeChildren: false,
          })

          return {
            selector: summary.locator?.preferred ?? buildCssPath(element),
            tag: summary.tag,
            text: summary.text,
            role: summary.role,
            attrs: summary.attrs,
            state: summary.state,
            visible: true,
            locator: summary.locator,
          }
        }),
    )

    const matches = semanticMatches.slice(0, LIMITS.searchMatchLimit).map(({ locator: _locator, ...match }) => match)

    return {
      found: matches.length > 0,
      matches,
      meta: {
        query,
        limit: LIMITS.searchMatchLimit,
        totalMatches: semanticMatches.length,
        truncated: semanticMatches.length > matches.length,
      },
    }
  }

  const descendants = uniqueByPreferred(
    collectSemanticChildren(document.body).map((element) =>
      summarizeNode(element, {
        depth: 0,
        maxDepth: 0,
        childLimit: 0,
        textLimit: LIMITS.textLimit,
        includeChildren: false,
      }),
    ),
  )

  const truncated = descendants.some((item) => item.meta?.textTruncated)

  return {
    title: document.title,
    url: window.location.href,
    descendants,
    meta: {
      textLimit: LIMITS.textLimit,
      truncated,
    },
  }
}

export function startClickMappingOverlay() {
  const stateKey = '__autobrowserClickMappingState__'
  const existing = (
    window as typeof window & {
      [stateKey]?: {
        overlay: HTMLDivElement
        points: Array<{ x: number; y: number }>
        listener: (event: MouseEvent) => void
      }
    }
  )[stateKey]

  if (existing?.overlay?.isConnected) {
    existing.overlay.remove()
  }

  const overlay = document.createElement('div')
  overlay.id = '__autobrowser_click_map_overlay__'
  overlay.setAttribute('data-autobrowser-click-map', 'true')
  overlay.style.position = 'fixed'
  overlay.style.left = '0'
  overlay.style.top = '0'
  overlay.style.width = '100vw'
  overlay.style.height = '100vh'
  overlay.style.zIndex = '2147483647'
  overlay.style.background = 'rgba(0, 0, 0, 0.01)'
  overlay.style.cursor = 'crosshair'

  const points: Array<{ x: number; y: number }> = []
  const listener = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    points.push({
      x: event.clientX,
      y: event.clientY,
    })
  }

  overlay.addEventListener('click', listener, true)
  document.documentElement.appendChild(overlay)
  ;(
    window as typeof window & {
      [stateKey]?: {
        overlay: HTMLDivElement
        points: Array<{ x: number; y: number }>
        listener: (event: MouseEvent) => void
      }
    }
  )[stateKey] = {
    overlay,
    points,
    listener,
  }

  const rect = overlay.getBoundingClientRect()

  return {
    rect: {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    },
    window: {
      screenLeft: window.screenLeft ?? window.screenX ?? 0,
      screenTop: window.screenTop ?? window.screenY ?? 0,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
    },
  }
}

export function finishClickMappingOverlay() {
  const stateKey = '__autobrowserClickMappingState__'
  const state = (
    window as typeof window & {
      [stateKey]?: {
        overlay: HTMLDivElement
        points: Array<{ x: number; y: number }>
        listener: (event: MouseEvent) => void
      }
    }
  )[stateKey]

  if (!state) {
    return {
      points: [],
    }
  }

  state.overlay.removeEventListener('click', state.listener, true)
  if (state.overlay.isConnected) {
    state.overlay.remove()
  }
  delete (window as typeof window & { [stateKey]?: unknown })[stateKey]

  return {
    points: state.points.slice(0, 2),
  }
}
