import { runInstallHostCommand } from "./commands/install-host.js";
import { runOpenCommand } from "./commands/open.js";
import { runQueryCommand } from "./commands/query.js";
import { runSummaryCommand } from "./commands/summary.js";
import { runTextCommand } from "./commands/text.js";
import { runServeCommand } from "./commands/serve.js";
import { runStatusCommand } from "./commands/status.js";
import { createHttpClient } from "./client/http-client.js";
import { requestStatus as defaultRequestStatus } from "./client/status-client.js";
import { installNativeHostManifest } from "./installers/native-host-installer.js";
import { startService as defaultStartService } from "./service/start-service.js";
import type { CliDependencies } from "./types/cli.js";

export function createCliRunner(client: CliDependencies) {
  return async function run(argv: string[]) {
    const [command, value] = argv;

    if (command === "open" && value) {
      return await runOpenCommand(client, value);
    }

    if (command === "query" && value) {
      return await runQueryCommand(client, value);
    }

    if (command === "summary") {
      return await runSummaryCommand(client);
    }

    if (command === "text" && value) {
      return await runTextCommand(client, value);
    }

    if (command === "serve") {
      return await runServeCommand(client.startService ?? defaultStartService);
    }

    if (command === "install-host" && value) {
      return await runInstallHostCommand(client.installHost ?? installNativeHostManifest, value);
    }

    if (command === "status") {
      return await runStatusCommand(client.requestStatus ?? defaultRequestStatus);
    }

    return {
      exitCode: 1,
      stdout: "",
      stderr: "Usage: autoBrowser <open|query|summary|text|serve|install-host|status> <value>"
    };
  };
}

export { createHttpClient } from "./client/http-client.js";
export type { CliRequestClient, CliDependencies, CliRunResult } from "./types/cli.js";
