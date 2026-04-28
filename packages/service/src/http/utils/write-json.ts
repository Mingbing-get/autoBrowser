import type { ServerResponse } from "node:http";
import type { JsonResponsePayload } from "../../types/service.js";

export function writeJson(response: ServerResponse, statusCode: number, payload: JsonResponsePayload) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(payload));
}
