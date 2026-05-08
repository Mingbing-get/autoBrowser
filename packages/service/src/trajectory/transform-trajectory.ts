import type { Point } from "../click/types.js";
import type { MouseTrajectoryRecord } from "./types.js";

export interface TimedScreenPoint extends Point {
  t: number;
}

export function transformMouseTrajectory(
  trajectory: MouseTrajectoryRecord,
  start: Point,
  target: Point
): TimedScreenPoint[] | null {
  if (trajectory.points.length < 2 || trajectory.sourceDistance <= 0) {
    return null;
  }

  const dx = target.x - start.x;
  const dy = target.y - start.y;
  const targetDistance = Math.hypot(dx, dy);

  if (targetDistance <= 0) {
    return null;
  }

  const sourceEnd = trajectory.points.at(-1);
  if (!sourceEnd) {
    return null;
  }

  const sourceAngle = Math.atan2(sourceEnd.y, sourceEnd.x);
  const targetAngle = Math.atan2(dy, dx);
  const rotation = targetAngle - sourceAngle;
  const scale = targetDistance / trajectory.sourceDistance;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  const transformed = trajectory.points.map((point) => ({
    x: start.x + (point.x * cos - point.y * sin) * scale,
    y: start.y + (point.x * sin + point.y * cos) * scale,
    t: point.t
  }));

  if (transformed.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    return null;
  }

  transformed[0] = { x: start.x, y: start.y, t: 0 };
  transformed[transformed.length - 1] = {
    x: target.x,
    y: target.y,
    t: transformed[transformed.length - 1]?.t ?? trajectory.durationMs
  };

  return transformed;
}
