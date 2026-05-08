import { readFileSync } from "node:fs";
import { runCloseCommand } from "./commands/close.js";
import { runClickCommand } from "./commands/click.js";
import { runDragCommand } from "./commands/drag.js";
import { runExtensionCommand } from "./commands/extension.js";
import { runScrollCommand } from "./commands/scroll.js";
import { runFlowCommand } from "./commands/flow.js";
import { runHoverCommand } from "./commands/hover.js";
import { runInputCommand } from "./commands/input.js";
import { runUploadCommand } from "./commands/upload.js";
import { runInstallHostCommand } from "./commands/install-host.js";
import { runOpenCommand } from "./commands/open.js";
import { runQueryCommand } from "./commands/query.js";
import { runSearchCommand } from "./commands/search.js";
import { runSearchFromPointCommand } from "./commands/search-from-point.js";
import { runSummaryCommand } from "./commands/summary.js";
import { runTabsCommand } from "./commands/tabs.js";
import { runTextCommand } from "./commands/text.js";
import { runRectCommand } from "./commands/rect.js";
import { runServeCommand } from "./commands/serve.js";
import { runStatusCommand } from "./commands/status.js";
import { createHttpClient } from "./client/http-client.js";
import { requestStatus as defaultRequestStatus } from "./client/status-client.js";
import { copyExtensionBundle } from "./installers/extension-installer.js";
import { installNativeHostManifest } from "./installers/native-host-installer.js";
import { startService as defaultStartService } from "./service/start-service.js";
import type { CliDependencies, CliRunResult } from "./types/cli.js";

const cliPackageVersion = readCliPackageVersion();
const helpText = [
  "Usage: ab <command> [options]",
  "",
  "Commands:",
  "  open <url>",
  "  close [--tabId <number>]",
  "  tabs",
  "  query <selector> [--tabId <number>]",
  "  search <text> [--tabId <number>]",
  "  search-from-point <x> <y> [--tabId <number>]",
  "  summary [--tabId <number>]",
  "  text <selector> [--tabId <number>]",
  "  rect <selector> [--tabId <number>]",
  "  click <selector> [--tabId <number>] [--minObserveMs <number>] [--maxObserveMs <number>] [--stableWindowMs <number>] [--maxRegions <number>] [--maxItemsPerRegion <number>] [--maxTextLength <number>]",
  "  hover <selector> [--tabId <number>] [--minObserveMs <number>] [--maxObserveMs <number>] [--stableWindowMs <number>] [--maxRegions <number>] [--maxItemsPerRegion <number>] [--maxTextLength <number>]",
  "  drag <selector> (--target <selector> --direction <anchor> | --x <integer> --y <integer>) [--tabId <number>]",
  "  scroll [--x <integer>] [--y <integer>] [--tabId <number>]",
  "  input <selector> --value <text> [--tabId <number>]",
  "  upload <selector> <filepath> [--tabId <number>]",
  "  flow <json-array>",
  "  serve",
  "  extension --path <directory>",
  "  install-host <chrome-extension-id>",
  "  status",
  "",
  "Options:",
  "  -h, --help     Show this help message",
  "  -v, --version  Show the current version"
].join("\n");

export function createCliRunner(client: CliDependencies) {
  return async function run(argv: string[]): Promise<CliRunResult> {
    const [command, ...args] = argv;

    if (!command || command === "-h" || command === "--help") {
      return {
        exitCode: 0,
        stdout: helpText,
        stderr: ""
      };
    }

    if (command === "-v" || command === "--version") {
      return {
        exitCode: 0,
        stdout: cliPackageVersion,
        stderr: ""
      };
    }

    if (command === "open" && args[0]) {
      return await runOpenCommand(client, args[0]);
    }

    if (command === "close") {
      const { tabId, error } = parseOptionalTabId(args);
      if (error) {
        return invalidUsage(error);
      }

      return await runCloseCommand(client, tabId);
    }

    if (command === "tabs") {
      return await runTabsCommand(client);
    }

    if (command === "query" && args[0]) {
      const { tabId, error } = parseOptionalTabId(args.slice(1));
      if (error) {
        return invalidUsage(error);
      }

      return await runQueryCommand(client, args[0], tabId);
    }

    if (command === "search" && args[0]) {
      const { tabId, error } = parseOptionalTabId(args.slice(1));
      if (error) {
        return invalidUsage(error);
      }

      return await runSearchCommand(client, args[0], tabId);
    }

    if (command === "search-from-point") {
      const parsed = parseSearchFromPointOptions(args);
      if (parsed.error || parsed.x === undefined || parsed.y === undefined) {
        return invalidUsage(parsed.error);
      }

      return await runSearchFromPointCommand(client, parsed.x, parsed.y, parsed.tabId);
    }

    if (command === "summary") {
      const { tabId, error } = parseOptionalTabId(args);
      if (error) {
        return invalidUsage(error);
      }

      return await runSummaryCommand(client, tabId);
    }

    if (command === "text" && args[0]) {
      const { tabId, error } = parseOptionalTabId(args.slice(1));
      if (error) {
        return invalidUsage(error);
      }

      return await runTextCommand(client, args[0], tabId);
    }

    if (command === "rect" && args[0]) {
      const { tabId, error } = parseOptionalTabId(args.slice(1));
      if (error) {
        return invalidUsage(error);
      }

      return await runRectCommand(client, args[0], tabId);
    }

    if (command === "click" && args[0]) {
      const { tabId, observe, error } = parseObserveOptions("click", args.slice(1));
      if (error) {
        return invalidUsage(error);
      }

      return await runClickCommand(client, args[0], tabId, observe);
    }

    if (command === "hover" && args[0]) {
      const { tabId, observe, error } = parseObserveOptions("hover", args.slice(1));
      if (error) {
        return invalidUsage(error);
      }

      return await runHoverCommand(client, args[0], tabId, observe);
    }

    if (command === "drag" && args[0]) {
      const parsed = parseDragOptions(args.slice(1));
      if (parsed.error || !parsed.payload) {
        return invalidUsage(parsed.error);
      }

      return await runDragCommand(client, {
        selector: args[0],
        ...parsed.payload
      });
    }

    if (command === "scroll") {
      const parsed = parseScrollOptions(args);
      if (parsed.error) {
        return invalidUsage(parsed.error);
      }

      return await runScrollCommand(client, parsed.deltaX ?? 0, parsed.deltaY ?? 0, parsed.tabId);
    }

    if (command === "input" && args[0]) {
      const parsed = parseInputOptions(args.slice(1));
      if (parsed.error) {
        return invalidUsage(parsed.error);
      }

      return await runInputCommand(client, args[0], parsed.value ?? "", parsed.tabId);
    }

    if (command === "upload" && args[0]) {
      const parsed = parseUploadOptions(args.slice(1));
      if (parsed.error || !parsed.filepath) {
        return invalidUsage(parsed.error);
      }

      return await runUploadCommand(client, args[0], parsed.filepath, parsed.tabId);
    }

    if (command === "flow" && args[0]) {
      return await runFlowCommand(client, args[0]);
    }

    if (command === "serve") {
      return await runServeCommand(client.startService ?? defaultStartService);
    }

    if (command === "extension") {
      const { path, error } = parseExtensionOptions(args);
      if (error || !path) {
        return invalidUsage(error);
      }

      return await runExtensionCommand(client.copyExtension ?? copyExtensionBundle, path);
    }

    if (command === "install-host" && args[0]) {
      return await runInstallHostCommand(client.installHost ?? installNativeHostManifest, args[0]);
    }

    if (command === "status") {
      return await runStatusCommand(client.requestStatus ?? defaultRequestStatus);
    }

    return invalidUsage();
  };
}

function parseOptionalTabId(args: string[]) {
  if (args.length === 0) {
    return {
      tabId: undefined,
      error: undefined
    };
  }

  if (args.length === 2 && args[0] === "--tabId") {
    const tabId = Number.parseInt(args[1] ?? "", 10);
    return Number.isInteger(tabId)
      ? { tabId, error: undefined }
      : { tabId: undefined, error: "tabId must be an integer" };
  }

  if (args.length === 1 && args[0]?.startsWith("--tabId=")) {
    const tabId = Number.parseInt(args[0].slice("--tabId=".length), 10);
    return Number.isInteger(tabId)
      ? { tabId, error: undefined }
      : { tabId: undefined, error: "tabId must be an integer" };
  }

  return {
    tabId: undefined,
    error:
      "Usage: close/query/search/search-from-point/text/rect/click accept [--tabId <number>] and summary accepts [--tabId <number>]"
  };
}

function parseIntegerFlag(
  args: string[],
  index: number,
  flag: string
): { value?: number; nextIndex: number; error?: string } {
  const arg = args[index];
  if (arg === flag) {
    const raw = args[index + 1];
    const value = Number.parseInt(raw ?? "", 10);
    if (!Number.isInteger(value)) {
      return {
        nextIndex: index,
        error: `${flag.slice(2)} must be an integer`
      };
    }

    return {
      value,
      nextIndex: index + 1
    };
  }

  if (arg?.startsWith(`${flag}=`)) {
    const value = Number.parseInt(arg.slice(flag.length + 1), 10);
    if (!Number.isInteger(value)) {
      return {
        nextIndex: index,
        error: `${flag.slice(2)} must be an integer`
      };
    }

    return {
      value,
      nextIndex: index
    };
  }

  return {
    nextIndex: index
  };
}

function parseObserveOptions(commandName: "click" | "hover", args: string[]) {
  let tabId: number | undefined;
  const observe: {
    minObserveMs?: number;
    maxObserveMs?: number;
    stableWindowMs?: number;
    maxRegions?: number;
    maxItemsPerRegion?: number;
    maxTextLength?: number;
  } = {};

  const observeFlagMap = {
    "--minObserveMs": "minObserveMs",
    "--maxObserveMs": "maxObserveMs",
    "--stableWindowMs": "stableWindowMs",
    "--maxRegions": "maxRegions",
    "--maxItemsPerRegion": "maxItemsPerRegion",
    "--maxTextLength": "maxTextLength"
  } as const;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--tabId" || arg?.startsWith("--tabId=")) {
      const parsed = parseIntegerFlag(args, index, "--tabId");
      if (parsed.error) {
        return {
          tabId: undefined,
          observe: undefined,
          error: parsed.error
        };
      }

      tabId = parsed.value;
      index = parsed.nextIndex;
      continue;
    }

    const matchedFlag = Object.keys(observeFlagMap).find(
      (flag) => arg === flag || arg?.startsWith(`${flag}=`)
    ) as keyof typeof observeFlagMap | undefined;
    if (matchedFlag) {
      const parsed = parseIntegerFlag(args, index, matchedFlag);
      if (parsed.error) {
        return {
          tabId: undefined,
          observe: undefined,
          error: parsed.error
        };
      }

      observe[observeFlagMap[matchedFlag]] = parsed.value;
      index = parsed.nextIndex;
      continue;
    }

    return {
      tabId: undefined,
      observe: undefined,
      error:
        `Usage: ${commandName} <selector> [--tabId <number>] [--minObserveMs <number>] [--maxObserveMs <number>] [--stableWindowMs <number>] [--maxRegions <number>] [--maxItemsPerRegion <number>] [--maxTextLength <number>]`
    };
  }

  return {
    tabId,
    observe,
    error: undefined
  };
}

function parseDragOptions(args: string[]) {
  let targetSelector: string | undefined;
  let direction: "t" | "tr" | "r" | "br" | "b" | "bl" | "l" | "tl" | undefined;
  let x: number | undefined;
  let y: number | undefined;
  let tabId: number | undefined;
  const allowedDirections = new Set(["t", "tr", "r", "br", "b", "bl", "l", "tl"]);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--target") {
      targetSelector = args[index + 1];
      if (!targetSelector) {
        return {
          payload: undefined,
          error: "drag requires --target <selector>"
        };
      }

      index += 1;
      continue;
    }

    if (arg?.startsWith("--target=")) {
      targetSelector = arg.slice("--target=".length);
      if (!targetSelector) {
        return {
          payload: undefined,
          error: "drag requires --target <selector>"
        };
      }

      continue;
    }

    if (arg === "--direction") {
      const nextDirection = args[index + 1];
      if (!nextDirection || !allowedDirections.has(nextDirection)) {
        return {
          payload: undefined,
          error: "direction must be one of t, tr, r, br, b, bl, l, tl"
        };
      }

      direction = nextDirection as typeof direction;
      index += 1;
      continue;
    }

    if (arg?.startsWith("--direction=")) {
      const nextDirection = arg.slice("--direction=".length);
      if (!allowedDirections.has(nextDirection)) {
        return {
          payload: undefined,
          error: "direction must be one of t, tr, r, br, b, bl, l, tl"
        };
      }

      direction = nextDirection as typeof direction;
      continue;
    }

    if (arg === "--x" || arg?.startsWith("--x=")) {
      const parsed = parseIntegerFlag(args, index, "--x");
      if (parsed.error) {
        return {
          payload: undefined,
          error: parsed.error
        };
      }

      x = parsed.value;
      index = parsed.nextIndex;
      continue;
    }

    if (arg === "--y" || arg?.startsWith("--y=")) {
      const parsed = parseIntegerFlag(args, index, "--y");
      if (parsed.error) {
        return {
          payload: undefined,
          error: parsed.error
        };
      }

      y = parsed.value;
      index = parsed.nextIndex;
      continue;
    }

    if (arg === "--tabId" || arg?.startsWith("--tabId=")) {
      const parsed = parseIntegerFlag(args, index, "--tabId");
      if (parsed.error) {
        return {
          payload: undefined,
          error: parsed.error
        };
      }

      tabId = parsed.value;
      index = parsed.nextIndex;
      continue;
    }

    return {
      payload: undefined,
      error:
        "Usage: drag <selector> (--target <selector> --direction <anchor> | --x <integer> --y <integer>) [--tabId <number>]"
    };
  }

  const usesTarget = targetSelector !== undefined || direction !== undefined;
  const usesViewport = x !== undefined || y !== undefined;

  if (usesTarget && usesViewport) {
    return {
      payload: undefined,
      error:
        "Usage: drag <selector> (--target <selector> --direction <anchor> | --x <integer> --y <integer>) [--tabId <number>]"
    };
  }

  if (targetSelector !== undefined || direction !== undefined) {
    if (!targetSelector || !direction) {
      return {
        payload: undefined,
        error:
          "Usage: drag <selector> --target <selector> --direction <anchor> [--tabId <number>]"
      };
    }

    return {
      payload: {
        targetSelector,
        direction,
        ...(typeof tabId === "number" ? { tabId } : {})
      },
      error: undefined
    };
  }

  if (x !== undefined || y !== undefined) {
    if (x === undefined || y === undefined) {
      return {
        payload: undefined,
        error: "drag requires both --x <integer> and --y <integer>"
      };
    }

    return {
      payload: {
        x,
        y,
        ...(typeof tabId === "number" ? { tabId } : {})
      },
      error: undefined
    };
  }

  return {
    payload: undefined,
    error:
      "Usage: drag <selector> (--target <selector> --direction <anchor> | --x <integer> --y <integer>) [--tabId <number>]"
  };
}

function parseSearchFromPointOptions(args: string[]) {
  if (args.length < 2 || args.length > 4) {
    return {
      x: undefined,
      y: undefined,
      tabId: undefined,
      error: "Usage: search-from-point <x> <y> [--tabId <number>]"
    };
  }

  const x = Number(args[0]);
  const y = Number(args[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return {
      x: undefined,
      y: undefined,
      tabId: undefined,
      error: "search-from-point requires numeric <x> and <y> coordinates"
    };
  }

  const { tabId, error } = parseOptionalTabId(args.slice(2));
  if (error) {
    return {
      x: undefined,
      y: undefined,
      tabId: undefined,
      error: "Usage: search-from-point <x> <y> [--tabId <number>]"
    };
  }

  return {
    x,
    y,
    tabId,
    error: undefined
  };
}

function parseInputOptions(args: string[]) {
  let value: string | undefined;
  let tabId: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--value") {
      const nextValue = args[index + 1];
      if (!nextValue) {
        return {
          value: undefined,
          tabId: undefined,
          error: "input requires --value <text>"
        };
      }

      value = nextValue;
      index += 1;
      continue;
    }

    if (arg?.startsWith("--value=")) {
      value = arg.slice("--value=".length);
      continue;
    }

    if (arg === "--tabId") {
      const rawTabId = args[index + 1];
      const parsedTabId = Number.parseInt(rawTabId ?? "", 10);
      if (!Number.isInteger(parsedTabId)) {
        return {
          value: undefined,
          tabId: undefined,
          error: "tabId must be an integer"
        };
      }

      tabId = parsedTabId;
      index += 1;
      continue;
    }

    if (arg?.startsWith("--tabId=")) {
      const parsedTabId = Number.parseInt(arg.slice("--tabId=".length), 10);
      if (!Number.isInteger(parsedTabId)) {
        return {
          value: undefined,
          tabId: undefined,
          error: "tabId must be an integer"
        };
      }

      tabId = parsedTabId;
      continue;
    }

    return {
      value: undefined,
      tabId: undefined,
      error: "Usage: input <selector> --value <text> [--tabId <number>]"
    };
  }

  if (value === undefined) {
    return {
      value: undefined,
      tabId: undefined,
      error: "input requires --value <text>"
    };
  }

  return {
    value,
    tabId,
    error: undefined
  };
}

function parseUploadOptions(args: string[]) {
  if (args.length === 0) {
    return {
      filepath: undefined,
      tabId: undefined,
      error: "Usage: upload <selector> <filepath> [--tabId <number>]"
    };
  }

  const filepath = args[0];
  const { tabId, error } = parseOptionalTabId(args.slice(1));
  if (error) {
    return {
      filepath: undefined,
      tabId: undefined,
      error: "Usage: upload <selector> <filepath> [--tabId <number>]"
    };
  }

  return {
    filepath,
    tabId,
    error: undefined
  };
}

function parseScrollOptions(args: string[]) {
  let deltaX: number | undefined;
  let deltaY: number | undefined;
  let tabId: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--x") {
      const value = Number.parseInt(args[index + 1] ?? "", 10);
      if (!Number.isInteger(value)) {
        return {
          deltaX: undefined,
          deltaY: undefined,
          tabId: undefined,
          error: "scroll requires --x <integer> when --x is provided"
        };
      }

      deltaX = value;
      index += 1;
      continue;
    }

    if (arg?.startsWith("--x=")) {
      const value = Number.parseInt(arg.slice("--x=".length), 10);
      if (!Number.isInteger(value)) {
        return {
          deltaX: undefined,
          deltaY: undefined,
          tabId: undefined,
          error: "scroll requires --x <integer> when --x is provided"
        };
      }

      deltaX = value;
      continue;
    }

    if (arg === "--y") {
      const value = Number.parseInt(args[index + 1] ?? "", 10);
      if (!Number.isInteger(value)) {
        return {
          deltaX: undefined,
          deltaY: undefined,
          tabId: undefined,
          error: "scroll requires --y <integer> when --y is provided"
        };
      }

      deltaY = value;
      index += 1;
      continue;
    }

    if (arg?.startsWith("--y=")) {
      const value = Number.parseInt(arg.slice("--y=".length), 10);
      if (!Number.isInteger(value)) {
        return {
          deltaX: undefined,
          deltaY: undefined,
          tabId: undefined,
          error: "scroll requires --y <integer> when --y is provided"
        };
      }

      deltaY = value;
      continue;
    }

    if (arg === "--tabId") {
      const parsedTabId = Number.parseInt(args[index + 1] ?? "", 10);
      if (!Number.isInteger(parsedTabId)) {
        return {
          deltaX: undefined,
          deltaY: undefined,
          tabId: undefined,
          error: "tabId must be an integer"
        };
      }

      tabId = parsedTabId;
      index += 1;
      continue;
    }

    if (arg?.startsWith("--tabId=")) {
      const parsedTabId = Number.parseInt(arg.slice("--tabId=".length), 10);
      if (!Number.isInteger(parsedTabId)) {
        return {
          deltaX: undefined,
          deltaY: undefined,
          tabId: undefined,
          error: "tabId must be an integer"
        };
      }

      tabId = parsedTabId;
      continue;
    }

    return {
      deltaX: undefined,
      deltaY: undefined,
      tabId: undefined,
      error: "Usage: scroll [--x <integer>] [--y <integer>] [--tabId <number>]"
    };
  }

  if (deltaX === undefined && deltaY === undefined) {
    return {
      deltaX: undefined,
      deltaY: undefined,
      tabId: undefined,
      error: "scroll requires at least one of --x <integer> or --y <integer>"
    };
  }

  return {
    deltaX: deltaX ?? 0,
    deltaY: deltaY ?? 0,
    tabId,
    error: undefined
  };
}

function parseExtensionOptions(args: string[]) {
  if (args.length === 2 && args[0] === "--path" && args[1]) {
    return {
      path: args[1],
      error: undefined
    };
  }

  if (args.length === 1 && args[0]?.startsWith("--path=")) {
    const value = args[0].slice("--path=".length);
    if (value) {
      return {
        path: value,
        error: undefined
      };
    }
  }

  return {
    path: undefined,
    error: "Usage: extension --path <directory>"
  };
}

function invalidUsage(
  stderr = `Unknown or incomplete command.\n\n${helpText}`
): CliRunResult {
  return {
    exitCode: 1,
    stdout: "",
    stderr
  };
}

function readCliPackageVersion() {
  const packageJsonPath = new URL("../package.json", import.meta.url);
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    version?: string;
  };

  return packageJson.version ?? "0.0.0";
}

export { createHttpClient } from "./client/http-client.js";
export type { CliRequestClient, CliDependencies, CliRunResult } from "./types/cli.js";
