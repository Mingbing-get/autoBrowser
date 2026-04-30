import type {
  DomRectPayload,
  PageSummaryPayload,
  PageTextPayload,
  QueryResultPayload,
  SearchFromPointResultPayload,
  SearchResultPayload,
} from '@autobrowser/shared'
import { waitForTabComplete } from '../tabs.js'

type DomInspectionArgs = {
  mode: 'query' | 'search' | 'searchFromPoint' | 'summary' | 'text' | 'rect'
  selector?: string
  text?: string
  x?: number
  y?: number
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

export async function searchElementsFromPointInTab(
  tabId: number,
  x: number,
  y: number,
): Promise<SearchFromPointResultPayload> {
  const [result] = await executeInspectionScript(tabId, {
    mode: 'searchFromPoint',
    x,
    y,
  })

  return (
    (result?.result as SearchFromPointResultPayload | undefined) ?? {
      found: false,
      x,
      y,
      matches: [],
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
    'class',
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

  function isMeaningfulLeafElement(element: Element) {
    return element.tagName.toLowerCase() === 'svg'
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

        if (canTraverseChildren(child) && !isMeaningfulLeafElement(child)) {
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

    if (includeChildren && depth < maxDepth && !isMeaningfulLeafElement(element)) {
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
    } else if (includeChildren && !isMeaningfulLeafElement(element)) {
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

        if (canTraverseChildren(child) && !isMeaningfulLeafElement(child)) {
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

  function collectStyleSnapshot(element: Element) {
    if (!(element instanceof HTMLElement)) {
      return undefined
    }

    const style = window.getComputedStyle(element)
    const snapshot = {
      zIndex: normalizeText(style.zIndex) || undefined,
      pointerEvents: normalizeText(style.pointerEvents) || undefined,
      display: normalizeText(style.display) || undefined,
      visibility: normalizeText(style.visibility) || undefined,
    }

    return Object.values(snapshot).some((value) => value !== undefined) ? snapshot : undefined
  }

  function summarizePointMatch(element: Element, level: number) {
    const summary = summarizeNode(element, {
      depth: 0,
      maxDepth: 0,
      childLimit: 0,
      textLimit: LIMITS.textLimit,
      includeChildren: false,
    })
    const rect = element instanceof HTMLElement ? element.getBoundingClientRect() : new DOMRect()

    return {
      level,
      selector: summary.locator?.preferred ?? buildCssPath(element),
      tag: summary.tag,
      text: summary.text,
      role: summary.role,
      attrs: summary.attrs,
      state: summary.state,
      visible: isVisible(element),
      locator: summary.locator,
      rect: {
        ...toRectPayload(rect),
        scrollWidth: element instanceof HTMLElement ? element.scrollWidth : 0,
        scrollHeight: element instanceof HTMLElement ? element.scrollHeight : 0,
      },
      styles: collectStyleSnapshot(element),
    }
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

  if (args.mode === 'searchFromPoint') {
    const x = typeof args.x === 'number' ? args.x : NaN
    const y = typeof args.y === 'number' ? args.y : NaN
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return {
        found: false,
        x: Number.isFinite(x) ? x : 0,
        y: Number.isFinite(y) ? y : 0,
        matches: [],
      }
    }

    const rawMatches =
      typeof document.elementsFromPoint === 'function' ? document.elementsFromPoint(x, y) : []
    const matches = rawMatches.map((element, level) => summarizePointMatch(element, level))

    return {
      found: matches.length > 0,
      x,
      y,
      matches,
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
