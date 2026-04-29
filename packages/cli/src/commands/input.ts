import type { CliRequestClient, CliRunResult } from "../types/cli.js";

export async function runInputCommand(
  client: CliRequestClient,
  selector: string,
  value: string,
  tabId?: number
): Promise<CliRunResult> {
  const result = await client.request("input", {
    selector,
    value,
    ...(typeof tabId === "number" ? { tabId } : {})
  });

  return {
    exitCode: 0,
    stdout: JSON.stringify(result, null, 2),
    stderr: ""
  };
}
