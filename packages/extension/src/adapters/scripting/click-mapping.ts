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
