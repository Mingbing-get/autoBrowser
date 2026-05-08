import type {
  MouseTrajectoryPointPayload,
  MouseTrajectoryRecordPayload,
  MouseTrajectorySummaryPayload
} from "@autobrowser/shared";

export interface MouseTrajectoryRecord extends MouseTrajectoryRecordPayload {}

export interface MouseTrajectorySummary extends MouseTrajectorySummaryPayload {}

export interface MouseTrajectoryRepository {
  list(): Promise<MouseTrajectoryRecord[]>;
  create(input: { points: MouseTrajectoryPointPayload[] }): Promise<MouseTrajectoryRecord>;
  delete(id: string): Promise<boolean>;
  getRandom(): Promise<MouseTrajectoryRecord | undefined>;
}

export function toMouseTrajectorySummary(record: MouseTrajectoryRecord): MouseTrajectorySummary {
  return {
    id: record.id,
    createdAt: record.createdAt,
    durationMs: record.durationMs,
    sourceDistance: record.sourceDistance,
    pointCount: record.pointCount
  };
}
