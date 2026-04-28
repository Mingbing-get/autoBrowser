import type { CliRequestClient, CliRunResult } from "../types/cli.js";

export async function runSummaryCommand(
  client: CliRequestClient,
  tabId?: number
): Promise<CliRunResult> {
  const result = await client.request("summary", typeof tabId === "number" ? { tabId } : {});
  return {
    exitCode: 0,
    stdout: JSON.stringify(result, null, 2),
    stderr: ""
  };
}
