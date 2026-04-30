import type { CliRequestClient, CliRunResult } from "../types/cli.js";

export async function runSearchFromPointCommand(
  client: CliRequestClient,
  x: number,
  y: number,
  tabId?: number
): Promise<CliRunResult> {
  const result = await client.request("searchFromPoint", {
    x,
    y,
    ...(typeof tabId === "number" ? { tabId } : {})
  });

  return {
    exitCode: 0,
    stdout: JSON.stringify(result, null, 2),
    stderr: ""
  };
}
