import { describe, expect, it, vi } from "vitest";
import {
  handleMouseTrajectoryApiRequest,
  type MouseTrajectoryApiRequest
} from "../src/runtime/mouse-trajectory-api.js";

describe("mouse trajectory api", () => {
  it("requests the trajectory list from the local service", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        payload: {
          trajectories: []
        }
      })
    });

    await expect(
      handleMouseTrajectoryApiRequest(
        {
          kind: "mouseTrajectoryApi",
          action: "list"
        },
        fetchMock as typeof fetch
      )
    ).resolves.toEqual({
      ok: true,
      payload: {
        trajectories: []
      }
    });

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:3210/commands/mouse-trajectory/list", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: "{}"
    });
  });

  it("posts recorded points when creating a trajectory", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        payload: {
          trajectory: {
            id: "traj_1",
            createdAt: "2026-05-08T10:00:00.000Z",
            durationMs: 12,
            sourceDistance: 32,
            pointCount: 2
          }
        }
      })
    });
    const request: MouseTrajectoryApiRequest = {
      kind: "mouseTrajectoryApi",
      action: "create",
      payload: {
        points: [
          { x: 100, y: 90, t: 0 },
          { x: 132, y: 90, t: 12 }
        ]
      }
    };

    await handleMouseTrajectoryApiRequest(request, fetchMock as typeof fetch);

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:3210/commands/mouse-trajectory/create", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(request.payload)
    });
  });

  it("posts the trajectory id when deleting a trajectory", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        payload: {
          deleted: true,
          id: "traj_1"
        }
      })
    });

    await handleMouseTrajectoryApiRequest(
      {
        kind: "mouseTrajectoryApi",
        action: "delete",
        payload: {
          id: "traj_1"
        }
      },
      fetchMock as typeof fetch
    );

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:3210/commands/mouse-trajectory/delete", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ id: "traj_1" })
    });
  });
});
