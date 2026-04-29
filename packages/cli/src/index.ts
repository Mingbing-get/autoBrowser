import { runCloseCommand } from "./commands/close.js";
import { runClickCommand } from "./commands/click.js";
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

function invalidUsage(
  stderr = "Usage: autoBrowser <open|close|tabs|query|summary|text|rect|click|serve|install-host|status> <value>"
): CliRunResult {
  return {
    exitCode: 1,
    stdout: "",
    stderr
  };
}

export { createHttpClient } from "./client/http-client.js";
export type { CliRequestClient, CliDependencies, CliRunResult } from "./types/cli.js";
