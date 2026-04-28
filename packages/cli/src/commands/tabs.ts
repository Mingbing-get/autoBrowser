import type { CliRequestClient, CliRunResult } from "../types/cli.js";

export async function runTabsCommand(client: CliRequestClient): Promise<CliRunResult> {
  const result = await client.request("tabs", {});
  return {
    exitCode: 0,
    stdout: JSON.stringify(result, null, 2),
    stderr: ""
  };
}
