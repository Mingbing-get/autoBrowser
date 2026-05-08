import type { CliRequestClient, CliRunResult } from "../types/cli.js";
import type { ObserveCommandOptions } from "@autobrowser/shared";

export async function runClickCommand(
  client: CliRequestClient,
  value: string,
  tabId?: number,
  observe?: ObserveCommandOptions
): Promise<CliRunResult> {
  const result = await client.request("click", {
    selector: value,
    ...(typeof tabId === "number" ? { tabId } : {}),
    ...(observe && Object.keys(observe).length > 0 ? { observe } : {})
  });

  return {
    exitCode: 0,
    stdout: JSON.stringify(result, null, 2),
    stderr: ""
  };
}
