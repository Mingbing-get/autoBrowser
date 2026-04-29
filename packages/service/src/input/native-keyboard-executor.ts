import { execFile as execFileCallback, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import type { InputSourceInfo } from "@autobrowser/shared";
import type { KeyboardController, KeyboardTypeResult } from "./types.js";

const execFile = promisify(execFileCallback);

export interface NativeKeyboardExecutorOptions {
  platform?: NodeJS.Platform;
  robotApi?: RobotKeyboardApi;
  execFileImpl?: typeof execFile;
}

interface RobotKeyboardApi {
  typeString(text: string): void;
  keyTap(key: string, modifier?: string | string[]): void;
}

export function createNativeKeyboardExecutor(
  options: NativeKeyboardExecutorOptions = {}
): KeyboardController {
  const platform = options.platform ?? process.platform;
  const robot = options.robotApi ?? loadRobotApi();
  const exec = options.execFileImpl ?? execFile;

  return {
    async typeText(value: string): Promise<KeyboardTypeResult> {
      const inputSource = platform === "darwin" ? await readMacInputSource(exec) : undefined;

      if (platform === "darwin" && containsNonAscii(value)) {
        await pasteUsingClipboard(exec, value);
        return {
          strategy: "paste",
          inputSource
        };
      }

      robot.typeString(value);
      return {
        strategy: "keystroke",
        inputSource
      };
    }
  };
}

function loadRobotApi(): RobotKeyboardApi {
  const require = createRequire(import.meta.url);
  return require("robotjs") as RobotKeyboardApi;
}

function containsNonAscii(value: string) {
  return /[^\x20-\x7E]/.test(value);
}

async function pasteUsingClipboard(exec: typeof execFile, value: string) {
  const previous = await readClipboard(exec);

  try {
    await writeClipboard(value);
    await exec("osascript", [
      "-e",
      'tell application "System Events" to keystroke "v" using command down'
    ]);
  } finally {
    await writeClipboard(previous);
  }
}

async function readClipboard(exec: typeof execFile) {
  try {
    const { stdout } = await exec("pbpaste", []);
    return stdout;
  } catch {
    return "";
  }
}

async function readMacInputSource(exec: typeof execFile): Promise<InputSourceInfo | undefined> {
  try {
    const { stdout } = await exec("defaults", [
      "read",
      "com.apple.HIToolbox",
      "AppleSelectedInputSources"
    ]);

    return parseMacInputSource(stdout);
  } catch {
    return undefined;
  }
}

export function parseMacInputSource(stdout: string): InputSourceInfo | undefined {
  const bundleId = matchField(stdout, /"Bundle ID"\s*=\s*"([^"]+)"/);
  const inputMode = matchField(stdout, /"Input Mode"\s*=\s*"([^"]+)"/);
  const keyboardLayout = matchField(stdout, /"KeyboardLayout Name"\s*=\s*"([^"]+)"/);

  if (inputMode) {
    return {
      kind: "inputMode",
      id: inputMode,
      localizedName: keyboardLayout ?? bundleId ?? inputMode
    };
  }

  if (keyboardLayout) {
    return {
      kind: "keyboardLayout",
      id: bundleId ?? keyboardLayout,
      localizedName: keyboardLayout
    };
  }

  if (bundleId) {
    return {
      kind: "inputMethod",
      id: bundleId,
      localizedName: bundleId
    };
  }

  return undefined;
}

function matchField(stdout: string, pattern: RegExp) {
  return stdout.match(pattern)?.[1];
}

async function writeClipboard(value: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("pbcopy", []);

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`pbcopy exited with code ${code ?? "unknown"}`));
    });

    child.stdin.on("error", reject);
    child.stdin.end(value);
  });
}
