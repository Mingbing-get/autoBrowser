import type { CliRequestClient, CliRunResult } from "../types/cli.js";

export async function runQueryCommand(
  client: CliRequestClient,
  value: string,
  tabId?: number
): Promise<CliRunResult> {
  const result = await client.request("query", {
    selector: value,
    ...(typeof tabId === "number" ? { tabId } : {})
  });
  return {
    exitCode: 0,
    stdout: JSON.stringify(result, null, 2),
    stderr: ""
  };
}
