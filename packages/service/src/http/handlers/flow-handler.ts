import type { IncomingMessage, ServerResponse } from "node:http";
import type { CommandPayloadMap } from "@autobrowser/shared";
import { readJsonBody } from "../utils/read-json-body.js";
import { writeJson } from "../utils/write-json.js";
import type { AutoBrowserService } from "../../types/service.js";

export async function handleFlowRequest(
  service: AutoBrowserService,
  request: IncomingMessage,
  response: ServerResponse
) {
  const body = await readJsonBody<CommandPayloadMap["flow"]>(request);

  if (!body || !Array.isArray(body.steps)) {
    writeJson(response, 400, {
      ok: false,
      error: "flow requires steps to be an array"
    });
    return;
  }

  const result = await service.dispatchCommand("flow", body);
  writeJson(response, result.ok ? 200 : 503, result);
}
