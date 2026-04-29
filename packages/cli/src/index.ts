import { runCloseCommand } from "./commands/close.js";
import { runClickCommand } from "./commands/click.js";
import { runScrollCommand } from "./commands/scroll.js";
import { runFlowCommand } from "./commands/flow.js";
import { runInputCommand } from "./commands/input.js";
import { runInstallHostCommand } from "./commands/install-host.js";
import { runOpenCommand } from "./commands/open.js";
import { runQueryCommand } from "./commands/query.js";
import { runSummaryCommand } from "./commands/summary.js";
import { runTabsCommand } from "./commands/tabs.js";
import { runTextCommand } from "./commands/text.js";
import { runRectCommand } from "./commands/rect.js";
import { runServeCommand } from "./commands/serve.js";
import { runStatusCommand } from "./commands/status.js";
import { createHttpClient } from "./client/http-client.js";
import { requestStatus as defaultRequestStatus } from "./client/status-client.js";
import { installNativeHostManifest } from "./installers/native-host-installer.js";
import { startService as defaultStartService } from "./service/start-service.js";
import type { CliDependencies, CliRunResult } from "./types/cli.js";

export function createCliRunner(client: CliDependencies) {
  return async function run(argv: string[]): Promise<CliRunResult> {
    const [command, ...args] = argv;

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
      const { tabId, error } = parseOptionalTabId(args.slice(1));
      if (error) {
        return invalidUsage(error);
      }

      return await runClickCommand(client, args[0], tabId);
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

    if (command === "flow" && args[0]) {
      return await runFlowCommand(client, args[0]);
    }

    if (command === "serve") {
      return await runServeCommand(client.startService ?? defaultStartService);
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
      "Usage: close/query/text/rect/click accept [--tabId <number>] and summary accepts [--tabId <number>]"
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

function invalidUsage(
  stderr = "Usage: autoBrowser <open|close|tabs|query|summary|text|rect|click|scroll|input|flow|serve|install-host|status> <value>"
): CliRunResult {
  return {
    exitCode: 1,
    stdout: "",
    stderr
  };
}

export { createHttpClient } from "./client/http-client.js";
export type { CliRequestClient, CliDependencies, CliRunResult } from "./types/cli.js";
