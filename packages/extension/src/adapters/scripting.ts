import type { PageSummaryPayload, QueryResultPayload } from '@autobrowser/shared'

type DomInspectionArgs = {
  mode: 'query' | 'summary'
  selector?: string
}

export async function querySelectorInTab(tabId: number, selector: string): Promise<QueryResultPayload> {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: inspectDom as (...args: unknown[]) => unknown,
    args: [{ mode: 'query', selector }],
  })

  return (result?.result as QueryResultPayload | undefined) ?? { found: false }
}

export async function summarizePageInTab(tabId: number): Promise<PageSummaryPayload> {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: inspectDom as (...args: unknown[]) => unknown,
    args: [{ mode: 'summary' }],
  })

  return (
    (result?.result as PageSummaryPayload | undefined) ?? {
      title: '',
      url: '',
      descendants: [],
      suggestedSelectors: [],
      meta: {
        textLimit: 120,
        truncated: false,
        hints: [],
      },
    }
  )
}

export function inspectDom(args: DomInspectionArgs) {
  const LIMITS = {
    ancestorLimit: 3,
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
      rawText = directText(element) || normalizeText((element as HTMLElement).innerText ?? element.textContent ?? '')
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

    return uniqueSelectors.length > 0
      ? {
          preferred: uniqueSelectors[0],
          fallbacks: uniqueSelectors.slice(1),
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

  function childSuggestions(element: Element, limit: number) {
    return collectSemanticChildren(element)
      .slice(0, limit)
      .map((child) => buildLocator(child)?.preferred)
      .filter((selector): selector is string => Boolean(selector))
  }

  function summarizeNode(
    element: Element,
    {
      depth,
      maxDepth,
      childLimit,
      textLimit,
      includeChildren,
      includeExplore,
    }: {
      depth: number
      maxDepth: number
      childLimit: number
      textLimit: number
      includeChildren: boolean
      includeExplore: boolean
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
          includeExplore: false,
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
      explore: includeExplore
        ? {
            suggestedSelectors: childSuggestions(element, childLimit + 3),
          }
        : undefined,
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
            includeExplore: false,
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
        includeExplore: false,
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
        includeExplore: false,
      }),
    )
    const descendantSelectors = children
      .map((child) => child.locator?.preferred)
      .filter((selector): selector is string => Boolean(selector))
    const selfSummary = summarizeNode(element, {
      depth: 0,
      maxDepth: 0,
      childLimit: 0,
      textLimit: LIMITS.textLimit,
      includeChildren: false,
      includeExplore: false,
    })
    const self = {
      ...selfSummary,
      children: children.length > 0 ? children : undefined,
      explore:
        descendantSelectors.length > 0
          ? {
              suggestedSelectors: descendantSelectors,
            }
          : undefined,
    }
    const hints: string[] = []
    const truncated = Boolean(
      self.meta?.textTruncated || self.children?.some((child: any) => child.meta?.textTruncated),
    )

    if (self.meta?.textTruncated) {
      hints.push('Text was truncated; query a narrower descendant if you need the full content.')
    }

    if (self.explore?.suggestedSelectors?.length) {
      hints.push('Suggested child selectors can be queried next to inspect omitted or deeper descendants.')
    }

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
        hints,
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
        includeExplore: false,
      }),
    ),
  )

  const suggestedSelectors = descendants
    .map((item) => item.locator?.preferred)
    .filter((selector): selector is string => Boolean(selector))
    .slice(0, 12)

  const truncated = descendants.some((item) => item.meta?.textTruncated)

  return {
    title: document.title,
    url: window.location.href,
    descendants,
    suggestedSelectors,
    meta: {
      textLimit: LIMITS.textLimit,
      truncated,
      hints: [
        'Summary returns meaningful descendants under body without including the body node itself.',
        'Use suggestedSelectors or query a specific selector to inspect a region in more detail.',
      ],
    },
  }
}
