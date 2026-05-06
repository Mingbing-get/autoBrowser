import { execFile as execFileCallback } from 'node:child_process'
import { createRequire } from 'node:module'
import { promisify } from 'node:util'
import { moveMouseHumanLike, randomOffset, type HumanMouseOptions } from './human-mouse.js'
import type { ClickController, CoordinateMapping, Point } from './types.js'

const execFile = promisify(execFileCallback)

type BrowserWindowActivator = (platform: NodeJS.Platform, appName: string) => Promise<void>

export interface NativeClickExecutorOptions extends HumanMouseOptions {
  browserAppName?: string
  browserWindowActivator?: BrowserWindowActivator
  focusSettleDelayMs?: number
  hoverDelayMs?: number
  scrollStepDelayMs?: number
  maxScrollStepPx?: number
  platform?: NodeJS.Platform
  robotApi?: RobotApi
}

interface RobotApi {
  getMousePos(): Point
  moveMouse(x: number, y: number): void
  mouseClick(button?: 'left' | 'right' | 'middle', double?: boolean): void
  mouseToggle?(down: 'down' | 'up', button?: 'left' | 'right' | 'middle'): void
  scrollMouse(x: number, y: number): void
}

export function createNativeClickExecutor(options: NativeClickExecutorOptions = {}): ClickController {
  const robot = options.robotApi ?? loadRobotApi()
  const mappings = new Map<number, CoordinateMapping>()
  const random = options.random ?? Math.random
  const sleep = options.sleep ?? wait
  const browserAppName = options.browserAppName ?? 'Google Chrome'
  const platform = options.platform ?? process.platform
  const browserWindowActivator = options.browserWindowActivator ?? activateBrowserWindow
  const focusSettleDelayMs = options.focusSettleDelayMs ?? 150
  const hoverDelayMs = options.hoverDelayMs ?? 35
  const scrollStepDelayMs = options.scrollStepDelayMs ?? 60
  const maxScrollStepPx = options.maxScrollStepPx ?? 40

  return {
    getMapping(tabId) {
      return mappings.get(tabId)
    },
    setMapping(tabId, mapping) {
      mappings.set(tabId, mapping)
    },
    async focusBrowserWindow() {
      await browserWindowActivator(platform, browserAppName)

      if (focusSettleDelayMs > 0) {
        await wait(focusSettleDelayMs)
      }
    },
    async clickAtScreenPoint(point: Point) {
      const target = {
        x: Math.round(point.x + randomOffset(random, 4)),
        y: Math.round(point.y + randomOffset(random, 4)),
      }

      await moveMouseHumanLike(robot, target, options)
      if (hoverDelayMs > 0) {
        await sleep(hoverDelayMs)
      }
      robot.mouseClick('left', false)
    },
    async mouseDownAtScreenPoint(point: Point) {
      await moveMouseHumanLike(robot, {
        x: Math.round(point.x),
        y: Math.round(point.y),
      }, options)
      if (hoverDelayMs > 0) {
        await sleep(hoverDelayMs)
      }
      robot.mouseToggle?.('down', 'left')
    },
    async moveMouseToScreenPoint(point: Point) {
      await moveMouseHumanLike(robot, {
        x: Math.round(point.x),
        y: Math.round(point.y),
      }, options)
    },
    async mouseUp(button = 'left') {
      robot.mouseToggle?.('up', button)
    },
    async scrollAtScreenPoint(point: Point) {
      const steps = buildScrollSteps(point, maxScrollStepPx)

      for (let index = 0; index < steps.length; index += 1) {
        const step = steps[index]
        robot.scrollMouse(step.x, step.y)

        if (index < steps.length - 1 && scrollStepDelayMs > 0) {
          await sleep(scrollStepDelayMs)
        }
      }
    },
  }
}

function buildScrollSteps(point: Point, maxScrollStepPx: number): Point[] {
  const targetX = Math.round(point.x)
  const targetY = Math.round(point.y)
  const stepSize = Math.max(1, Math.round(maxScrollStepPx))
  const stepCount = Math.max(1, Math.ceil(Math.max(Math.abs(targetX), Math.abs(targetY)) / stepSize))
  const steps: Point[] = []
  let consumedX = 0
  let consumedY = 0

  for (let index = 1; index <= stepCount; index += 1) {
    const nextConsumedX = Math.round((targetX * index) / stepCount)
    const nextConsumedY = Math.round((targetY * index) / stepCount)
    steps.push({
      x: nextConsumedX - consumedX,
      y: nextConsumedY - consumedY,
    })
    consumedX = nextConsumedX
    consumedY = nextConsumedY
  }

  return steps
}

function loadRobotApi(): RobotApi {
  const require = createRequire(import.meta.url)
  return require('robotjs') as RobotApi
}

async function activateBrowserWindow(platform: NodeJS.Platform, appName: string) {
  if (platform === 'darwin') {
    await execFile('osascript', ['-e', `tell application "${escapeAppleScriptString(appName)}" to activate`])
    return
  }

  if (platform === 'win32') {
    await execFile('powershell', [
      '-NoProfile',
      '-Command',
      `(New-Object -ComObject WScript.Shell).AppActivate('${escapePowerShellString(appName)}')`,
    ])
  }
}

function escapeAppleScriptString(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

function escapePowerShellString(value: string) {
  return value.replaceAll("'", "''")
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })
}
