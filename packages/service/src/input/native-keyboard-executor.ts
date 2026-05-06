import { execFile as execFileCallback } from 'node:child_process'
import { createRequire } from 'node:module'
import { promisify } from 'node:util'
import type { InputSourceInfo } from '@autobrowser/shared'
import type { KeyboardController, KeyboardTypeResult } from './types.js'

const execFile = promisify(execFileCallback)

export interface NativeKeyboardExecutorOptions {
  platform?: NodeJS.Platform
  robotApi?: RobotKeyboardApi
  random?: () => number
  sleep?: (delayMs: number) => Promise<void>
  readInputSource?: () => Promise<InputSourceInfo | undefined>
  clipboardApi?: ClipboardApi
  focusSettleDelayMs?: number
  pasteSettleDelayMs?: number
  minKeyDelayMs?: number
  maxKeyDelayMs?: number
}

interface RobotKeyboardApi {
  typeString(text: string): void
  keyTap(key: string, modifier?: string | string[]): void
}

interface ClipboardApi {
  copy(text: string, callback: (error?: Error | null) => void): void
}

export function createNativeKeyboardExecutor(options: NativeKeyboardExecutorOptions = {}): KeyboardController {
  const platform = options.platform ?? process.platform
  const robot = options.robotApi ?? loadRobotApi()
  const random = options.random ?? Math.random
  const sleep = options.sleep ?? wait
  const readInputSource = options.readInputSource ?? createInputSourceReader(platform)
  const clipboardApi = options.clipboardApi ?? loadClipboardApi()
  const focusSettleDelayMs = options.focusSettleDelayMs ?? 85
  const pasteSettleDelayMs = options.pasteSettleDelayMs ?? 60
  const minKeyDelayMs = options.minKeyDelayMs ?? 45
  const maxKeyDelayMs = options.maxKeyDelayMs ?? 160

  return {
    async typeText(value: string): Promise<KeyboardTypeResult> {
      const inputSource = await readInputSource()

      if (focusSettleDelayMs > 0) {
        await sleep(focusSettleDelayMs)
      }

      if (shouldPasteText(platform, value)) {
        await copyToClipboard(clipboardApi, value)
        robot.keyTap('v', platform === 'darwin' ? 'command' : 'control')

        if (pasteSettleDelayMs > 0) {
          await sleep(pasteSettleDelayMs)
        }

        return {
          strategy: 'paste',
          inputSource,
        }
      }

      await typeAsciiHumanLike(robot, value, {
        random,
        sleep,
        minKeyDelayMs,
        maxKeyDelayMs,
      })

      return {
        strategy: 'keystroke',
        inputSource,
      }
    },
    async uploadFile(filepath: string) {
      if (platform === 'darwin') {
        robot.keyTap('g', ['command', 'shift'])
        await sleep(1000)
        await pasteText(robot, clipboardApi, platform, filepath)
        await sleep(1000)
        robot.keyTap('enter')
        await sleep(1000)
        robot.keyTap('enter')

        return {
          uploaded: true as const,
          strategy: 'native-dialog' as const,
        }
      }

      await pasteText(robot, clipboardApi, platform, filepath)
      await sleep(1000)
      robot.keyTap('enter')
      await sleep(1000)
      robot.keyTap('enter')

      return {
        uploaded: true as const,
        strategy: 'native-dialog' as const,
      }
    },
  }
}

function loadRobotApi(): RobotKeyboardApi {
  const require = createRequire(import.meta.url)
  return require('robotjs') as RobotKeyboardApi
}

function loadClipboardApi(): ClipboardApi {
  const require = createRequire(import.meta.url)
  return require('copy-paste') as ClipboardApi
}

function createInputSourceReader(platform: NodeJS.Platform) {
  if (platform !== 'darwin') {
    return async () => undefined
  }

  return async () => readMacInputSource(execFile)
}

function shouldPasteText(platform: NodeJS.Platform, value: string) {
  return (platform === 'darwin' || platform === 'win32') && /[^\x20-\x7E]/.test(value)
}

async function readMacInputSource(exec: typeof execFile): Promise<InputSourceInfo | undefined> {
  try {
    const { stdout } = await exec('defaults', ['read', 'com.apple.HIToolbox', 'AppleSelectedInputSources'])
    return parseMacInputSource(stdout)
  } catch {
    return undefined
  }
}

export function parseMacInputSource(stdout: string): InputSourceInfo | undefined {
  const bundleId = matchField(stdout, /"Bundle ID"\s*=\s*"([^"]+)"/)
  const inputMode = matchField(stdout, /"Input Mode"\s*=\s*"([^"]+)"/)
  const keyboardLayout = matchField(stdout, /"KeyboardLayout Name"\s*=\s*"([^"]+)"/)

  if (inputMode) {
    return {
      kind: 'inputMode',
      id: inputMode,
      localizedName: keyboardLayout ?? bundleId ?? inputMode,
    }
  }

  if (keyboardLayout) {
    return {
      kind: 'keyboardLayout',
      id: bundleId ?? keyboardLayout,
      localizedName: keyboardLayout,
    }
  }

  if (bundleId) {
    return {
      kind: 'inputMethod',
      id: bundleId,
      localizedName: bundleId,
    }
  }

  return undefined
}

function matchField(stdout: string, pattern: RegExp) {
  return stdout.match(pattern)?.[1]
}

function copyToClipboard(clipboardApi: ClipboardApi, value: string) {
  return new Promise<void>((resolve, reject) => {
    clipboardApi.copy(value, (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

async function pasteText(
  robot: RobotKeyboardApi,
  clipboardApi: ClipboardApi,
  platform: NodeJS.Platform,
  value: string
) {
  await copyToClipboard(clipboardApi, value)
  robot.keyTap('v', platform === 'darwin' ? 'command' : 'control')
}

async function typeAsciiHumanLike(
  robot: RobotKeyboardApi,
  value: string,
  options: {
    random: () => number
    sleep: (delayMs: number) => Promise<void>
    minKeyDelayMs: number
    maxKeyDelayMs: number
  },
) {
  const characters = Array.from(value)

  for (let index = 0; index < characters.length; index += 1) {
    robot.typeString(characters[index] ?? '')

    if (index < characters.length - 1) {
      await options.sleep(nextTypingDelay(characters, index, options))
    }
  }
}

function nextTypingDelay(
  characters: string[],
  index: number,
  options: {
    random: () => number
    minKeyDelayMs: number
    maxKeyDelayMs: number
  },
) {
  const { random, minKeyDelayMs, maxKeyDelayMs } = options
  const span = Math.max(0, maxKeyDelayMs - minKeyDelayMs)
  const baseDelay = minKeyDelayMs + Math.round(span * random())
  const nextChar = characters[index + 1] ?? ''
  const currentChar = characters[index] ?? ''
  const punctuationPause = /[\s,.;:!?]/.test(currentChar) ? 35 + Math.round(random() * 90) : 0
  const burstPause = random() > 0.88 ? 60 + Math.round(random() * 140) : 0
  const transitionPause = /\d/.test(currentChar) !== /\d/.test(nextChar) ? 20 + Math.round(random() * 55) : 0

  return baseDelay + punctuationPause + burstPause + transitionPause
}

async function wait(delayMs: number) {
  await new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, delayMs)
  })
}
