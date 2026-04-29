import type { CliRequestClient, CliRunResult } from "../types/cli.js";

export async function runScrollCommand(
  client: CliRequestClient,
  deltaX: number,
  deltaY: number,
  tabId?: number
): Promise<CliRunResult> {
  const result = await client.request("scroll", {
    deltaX,
    deltaY,
    ...(typeof tabId === "number" ? { tabId } : {})
  });

  return {
    exitCode: 0,
    stdout: JSON.stringify(result, null, 2),
    stderr: ""
  };
}
