import type {
  MouseTrajectoryCreateCommandPayload,
  MouseTrajectoryCreateResultPayload,
  MouseTrajectoryDeleteCommandPayload,
  MouseTrajectoryDeleteResultPayload,
  MouseTrajectoryListResultPayload
} from "@autobrowser/shared";

const SERVICE_BASE_URL = "http://127.0.0.1:3210";

export type MouseTrajectoryApiRequest =
  | {
      kind: "mouseTrajectoryApi";
      action: "list";
    }
  | {
      kind: "mouseTrajectoryApi";
      action: "create";
      payload: MouseTrajectoryCreateCommandPayload;
    }
  | {
      kind: "mouseTrajectoryApi";
      action: "delete";
      payload: MouseTrajectoryDeleteCommandPayload;
    };

export type MouseTrajectoryApiResponse =
  | {
      ok: true;
      payload:
        | MouseTrajectoryListResultPayload["trajectories"] extends never
          ? never
          : MouseTrajectoryListResultPayload
        | MouseTrajectoryCreateResultPayload
        | MouseTrajectoryDeleteResultPayload;
    }
  | {
      ok: false;
      error: string;
    };

export async function handleMouseTrajectoryApiRequest(
  request: MouseTrajectoryApiRequest,
  fetchImpl: typeof fetch = fetch
): Promise<MouseTrajectoryApiResponse> {
  if (request.action === "list") {
    return await postJson("mouse-trajectory/list", {}, fetchImpl);
  }

  if (request.action === "create") {
    return await postJson("mouse-trajectory/create", request.payload, fetchImpl);
  }

  return await postJson("mouse-trajectory/delete", request.payload, fetchImpl);
}

async function postJson(
  path: string,
  payload: object,
  fetchImpl: typeof fetch
): Promise<MouseTrajectoryApiResponse> {
  const response = await fetchImpl(`${SERVICE_BASE_URL}/commands/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const result = (await response.json()) as MouseTrajectoryApiResponse;
  if (!response.ok && result.ok) {
    return {
      ok: false,
      error: "service request failed"
    };
  }

  return result;
}
