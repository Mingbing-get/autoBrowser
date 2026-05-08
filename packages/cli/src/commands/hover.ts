import type { HoverCommandPayload } from "@autobrowser/shared";
import type { CliRequestClient, CliRunResult } from "../types/cli.js";

export async function runHoverCommand(
  client: CliRequestClient,
  value: string,
  tabId?: number,
  observe?: HoverCommandPayload["observe"]
): Promise<CliRunResult> {
  const result = await client.request("hover", {
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
