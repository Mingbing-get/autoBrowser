import type { IncomingMessage, ServerResponse } from "node:http";
import type { CommandPayloadMap } from "@autobrowser/shared";
import { readJsonBody } from "../utils/read-json-body.js";
import { writeJson } from "../utils/write-json.js";
import type { AutoBrowserService } from "../../types/service.js";

export async function handleDragRequest(
  service: AutoBrowserService,
  request: IncomingMessage,
  response: ServerResponse
) {
  const body = await readJsonBody<CommandPayloadMap["drag"]>(request);
  const result = await service.dispatchCommand("drag", body);
  writeJson(response, result.ok ? 200 : 503, result);
}
