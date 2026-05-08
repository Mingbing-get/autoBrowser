import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createFileMouseTrajectoryRepository } from "../src/trajectory/file-trajectory-repository.js";

describe("file mouse trajectory repository", () => {
  it("treats a missing file as an empty trajectory list", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "autobrowser-traj-"));
    const repository = createFileMouseTrajectoryRepository({
      filePath: path.join(tempDir, "mouse-trajectories.json")
    });

    await expect(repository.list()).resolves.toEqual([]);
  });

  it("normalizes and persists created trajectories", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "autobrowser-traj-"));
    const filePath = path.join(tempDir, "mouse-trajectories.json");
    const repository = createFileMouseTrajectoryRepository({ filePath });

    const created = await repository.create({
      points: [
        { x: 120, y: 80, t: 0 },
        { x: 150, y: 96, t: 14 },
        { x: 210, y: 80, t: 30 }
      ]
    });

    expect(created.pointCount).toBe(3);
    expect(created.durationMs).toBe(30);
    expect(created.sourceDistance).toBe(90);
    expect(created.points).toEqual([
      { x: 0, y: 0, t: 0 },
      { x: 30, y: 16, t: 14 },
      { x: 90, y: 0, t: 30 }
    ]);

    await expect(repository.list()).resolves.toEqual([created]);

    const persisted = JSON.parse(await readFile(filePath, "utf8")) as {
      trajectories: Array<{ id: string }>;
    };
    expect(persisted.trajectories).toHaveLength(1);
    expect(persisted.trajectories[0]?.id).toBe(created.id);
  });

  it("deletes trajectories by id", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "autobrowser-traj-"));
    const repository = createFileMouseTrajectoryRepository({
      filePath: path.join(tempDir, "mouse-trajectories.json")
    });

    const created = await repository.create({
      points: [
        { x: 40, y: 60, t: 0 },
        { x: 100, y: 90, t: 12 }
      ]
    });

    await expect(repository.delete(created.id)).resolves.toBe(true);
    await expect(repository.list()).resolves.toEqual([]);
  });
});
