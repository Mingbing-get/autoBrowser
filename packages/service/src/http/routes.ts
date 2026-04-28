import type { IncomingMessage, ServerResponse } from "node:http";
import { handleHealthRequest } from "./handlers/health-handler.js";
import { handleOpenRequest } from "./handlers/open-handler.js";
import { handleQueryRequest } from "./handlers/query-handler.js";
import { writeJson } from "./utils/write-json.js";
import type { AutoBrowserService } from "../types/service.js";

export async function handleRequest(
  service: AutoBrowserService,
  request: IncomingMessage,
  response: ServerResponse
) {
  if (request.method === "GET" && request.url === "/health") {
    handleHealthRequest(service, response);
    return;
  }

  if (request.method === "POST" && request.url === "/commands/open") {
    await handleOpenRequest(service, request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/commands/query") {
    await handleQueryRequest(service, request, response);
    return;
  }

  writeJson(response, 404, { ok: false, error: "not found" });
}
