import { execFile as execFileCallback } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { moveMouseHumanLike, randomOffset, type HumanMouseOptions } from "./human-mouse.js";
import type { ClickController, CoordinateMapping, Point } from "./types.js";

const execFile = promisify(execFileCallback);

type BrowserWindowActivator = (platform: NodeJS.Platform, appName: string) => Promise<void>;

export interface NativeClickExecutorOptions extends HumanMouseOptions {
  browserAppName?: string;
  browserWindowActivator?: BrowserWindowActivator;
  focusSettleDelayMs?: number;
  platform?: NodeJS.Platform;
}

interface RobotApi {
  getMousePos(): Point;
  moveMouse(x: number, y: number): void;
  mouseClick(button?: "left" | "right" | "middle", double?: boolean): void;
}

export function createNativeClickExecutor(
  options: NativeClickExecutorOptions = {}
): ClickController {
  const robot = loadRobotApi();
  const mappings = new Map<number, CoordinateMapping>();
  const random = options.random ?? Math.random;
  const browserAppName = options.browserAppName ?? "Google Chrome";
  const platform = options.platform ?? process.platform;
  const browserWindowActivator = options.browserWindowActivator ?? activateBrowserWindow;
  const focusSettleDelayMs = options.focusSettleDelayMs ?? 150;

  return {
    getMapping(tabId) {
      return mappings.get(tabId);
    },
    setMapping(tabId, mapping) {
      mappings.set(tabId, mapping);
    },
    async focusBrowserWindow() {
      await browserWindowActivator(platform, browserAppName);

      if (focusSettleDelayMs > 0) {
        await wait(focusSettleDelayMs);
      }
    },
    async clickAtScreenPoint(point: Point) {
      const target = {
        x: Math.round(point.x + randomOffset(random, 4)),
        y: Math.round(point.y + randomOffset(random, 4))
      };

      await moveMouseHumanLike(robot, target, options);
      robot.mouseClick("left", false);
    }
  };
}

function loadRobotApi(): RobotApi {
  const require = createRequire(import.meta.url);
  return require("robotjs") as RobotApi;
}

async function activateBrowserWindow(platform: NodeJS.Platform, appName: string) {
  if (platform === "darwin") {
    await execFile("osascript", [
      "-e",
      `tell application "${escapeAppleScriptString(appName)}" to activate`
    ]);
    return;
  }

  if (platform === "win32") {
    await execFile("powershell", [
      "-NoProfile",
      "-Command",
      `(New-Object -ComObject WScript.Shell).AppActivate('${escapePowerShellString(appName)}')`
    ]);
  }
}

function escapeAppleScriptString(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}

function escapePowerShellString(value: string) {
  return value.replaceAll("'", "''");
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}
