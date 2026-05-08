import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { MouseTrajectoryPointPayload } from "@autobrowser/shared";
import type { MouseTrajectoryRecord, MouseTrajectoryRepository } from "./types.js";

interface StoredTrajectoryFile {
  trajectories: MouseTrajectoryRecord[];
}

export interface FileMouseTrajectoryRepositoryOptions {
  filePath?: string;
  now?: () => Date;
  createId?: () => string;
}

const DEFAULT_FILE_PATH = path.resolve(process.cwd(), "packages/service/.data/mouse-trajectories.json");

export function createFileMouseTrajectoryRepository(
  options: FileMouseTrajectoryRepositoryOptions = {}
): MouseTrajectoryRepository {
  const filePath = options.filePath ?? DEFAULT_FILE_PATH;
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? (() => `traj_${randomUUID()}`);

  return {
    async list() {
      const file = await readTrajectoryFile(filePath);
      return file.trajectories.filter(isValidTrajectoryRecord);
    },
    async create(input) {
      const normalized = normalizeTrajectoryPoints(input.points);
      if (!normalized) {
        throw new Error("invalid mouse trajectory");
      }

      const trajectory: MouseTrajectoryRecord = {
        id: createId(),
        createdAt: now().toISOString(),
        durationMs: normalized.at(-1)?.t ?? 0,
        sourceDistance: calculateDistance(normalized.at(-1) ?? { x: 0, y: 0, t: 0 }),
        pointCount: normalized.length,
        points: normalized
      };

      const file = await readTrajectoryFile(filePath);
      file.trajectories.push(trajectory);
      await writeTrajectoryFile(filePath, file);
      return trajectory;
    },
    async delete(id) {
      const file = await readTrajectoryFile(filePath);
      const nextTrajectories = file.trajectories.filter((trajectory) => trajectory.id !== id);
      const deleted = nextTrajectories.length !== file.trajectories.length;
      if (deleted) {
        await writeTrajectoryFile(filePath, {
          trajectories: nextTrajectories
        });
      }
      return deleted;
    },
    async getRandom() {
      const trajectories = await this.list();
      if (trajectories.length === 0) {
        return undefined;
      }
      const index = Math.floor(Math.random() * trajectories.length);
      return trajectories[index];
    }
  };
}

async function readTrajectoryFile(filePath: string): Promise<StoredTrajectoryFile> {
  try {
    const content = await readFile(filePath, "utf8");
    const parsed = JSON.parse(content) as StoredTrajectoryFile;

    if (!parsed || !Array.isArray(parsed.trajectories)) {
      return { trajectories: [] };
    }

    return {
      trajectories: parsed.trajectories.filter(isValidTrajectoryRecord)
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { trajectories: [] };
    }
    return { trajectories: [] };
  }
}

async function writeTrajectoryFile(filePath: string, file: StoredTrajectoryFile) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(file, null, 2)}\n`, "utf8");
}

function normalizeTrajectoryPoints(points: MouseTrajectoryPointPayload[]) {
  if (!Array.isArray(points) || points.length < 2) {
    return null;
  }

  const first = points[0];
  if (!isFinitePoint(first)) {
    return null;
  }

  const normalized = points
    .filter(isFinitePoint)
    .map((point) => ({
      x: point.x - first.x,
      y: point.y - first.y,
      t: point.t - first.t
    }))
    .filter((point, index, items) => {
      if (index === 0) {
        return true;
      }
      return point.t >= items[index - 1]!.t;
    });

  if (normalized.length < 2) {
    return null;
  }

  const last = normalized.at(-1);
  if (!last || calculateDistance(last) <= 0) {
    return null;
  }

  normalized[0] = { x: 0, y: 0, t: 0 };
  return normalized;
}

function isValidTrajectoryRecord(record: unknown): record is MouseTrajectoryRecord {
  if (!record || typeof record !== "object") {
    return false;
  }

  const candidate = record as MouseTrajectoryRecord;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.createdAt === "string" &&
    Number.isFinite(candidate.durationMs) &&
    Number.isFinite(candidate.sourceDistance) &&
    Number.isFinite(candidate.pointCount) &&
    Array.isArray(candidate.points) &&
    candidate.points.length >= 2 &&
    candidate.sourceDistance > 0 &&
    candidate.points.every(isFinitePoint)
  );
}

function isFinitePoint(point: unknown): point is MouseTrajectoryPointPayload {
  return (
    !!point &&
    typeof point === "object" &&
    Number.isFinite((point as MouseTrajectoryPointPayload).x) &&
    Number.isFinite((point as MouseTrajectoryPointPayload).y) &&
    Number.isFinite((point as MouseTrajectoryPointPayload).t)
  );
}

function calculateDistance(point: Pick<MouseTrajectoryPointPayload, "x" | "y">) {
  return Math.hypot(point.x, point.y);
}
