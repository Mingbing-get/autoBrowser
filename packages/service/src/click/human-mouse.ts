import type { Point } from "./types.js";

export interface HumanMouseApi {
  getMousePos(): Point;
  moveMouse(x: number, y: number): void;
  mouseClick(button?: "left" | "right" | "middle", double?: boolean): void;
}

export interface HumanMouseOptions {
  random?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
}

export async function moveMouseHumanLike(
  api: HumanMouseApi,
  target: Point,
  options: HumanMouseOptions = {}
) {
  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? defaultSleep;
  const start = api.getMousePos();
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  const distance = Math.hypot(dx, dy);

  if (distance < 1) {
    api.moveMouse(Math.round(target.x), Math.round(target.y));
    return;
  }

  const steps = Math.max(12, Math.min(36, Math.round(distance / 18)));
  const curve = createPrimaryCurve(start, target, distance, random);

  for (let index = 1; index <= steps; index += 1) {
    const progress = index / steps;
    const eased = easeOutQuadratic(progress);
    const curvePoint = sampleCubicBezier(curve, eased);
    const jitterScale = (1 - progress) * 3;
    const settling = progress > 0.84 ? (progress - 0.84) / 0.16 : 0;
    const settledPoint = settling > 0
      ? {
          x: blend(curvePoint.x, target.x, easeInQuadratic(settling)),
          y: blend(curvePoint.y, target.y, easeInQuadratic(settling))
        }
      : curvePoint;
    const x = Math.round(settledPoint.x + randomOffset(random, jitterScale));
    const y = Math.round(settledPoint.y + randomOffset(random, jitterScale));
    api.moveMouse(x, y);
    const slowdown = Math.pow(progress, 2) * 10;
    await sleep(3 + Math.floor(random() * 6) + Math.round(slowdown));
  }

  api.moveMouse(Math.round(target.x), Math.round(target.y));
}

export function randomOffset(random: () => number, magnitude: number) {
  return (random() - 0.5) * 2 * magnitude;
}

interface CubicBezierCurve {
  start: Point;
  control1: Point;
  control2: Point;
  end: Point;
}

function createPrimaryCurve(
  start: Point,
  target: Point,
  distance: number,
  random: () => number
): CubicBezierCurve {
  const unit = {
    x: (target.x - start.x) / distance,
    y: (target.y - start.y) / distance
  };
  const normal = {
    x: -unit.y,
    y: unit.x
  };
  const firstAnchor = 0.2 + random() * 0.18;
  const secondAnchor = 0.58 + random() * 0.22;
  const firstCurveMagnitude = clamp(distance * (0.1 + random() * 0.08), 8, 70);
  const secondCurveMagnitude = clamp(firstCurveMagnitude * (0.35 + random() * 0.35), 4, 42);
  const firstCurveDirection = random() < 0.5 ? -1 : 1;
  const secondCurveDirection = random() < 0.72 ? firstCurveDirection : -firstCurveDirection;

  return {
    start,
    control1: offsetAlongPath(start, unit, normal, distance * firstAnchor, firstCurveMagnitude * firstCurveDirection),
    control2: offsetAlongPath(start, unit, normal, distance * secondAnchor, secondCurveMagnitude * secondCurveDirection),
    end: target
  };
}

function offsetAlongPath(
  start: Point,
  unit: Point,
  normal: Point,
  distanceAlong: number,
  distanceAway: number
) {
  return {
    x: start.x + unit.x * distanceAlong + normal.x * distanceAway,
    y: start.y + unit.y * distanceAlong + normal.y * distanceAway
  };
}

function sampleCubicBezier(curve: CubicBezierCurve, t: number): Point {
  const inverse = 1 - t;
  return {
    x:
      Math.pow(inverse, 3) * curve.start.x +
      3 * Math.pow(inverse, 2) * t * curve.control1.x +
      3 * inverse * Math.pow(t, 2) * curve.control2.x +
      Math.pow(t, 3) * curve.end.x,
    y:
      Math.pow(inverse, 3) * curve.start.y +
      3 * Math.pow(inverse, 2) * t * curve.control1.y +
      3 * inverse * Math.pow(t, 2) * curve.control2.y +
      Math.pow(t, 3) * curve.end.y
  };
}

function easeOutQuadratic(progress: number) {
  return 1 - Math.pow(1 - progress, 2);
}

function easeInQuadratic(progress: number) {
  return Math.pow(progress, 2);
}

function blend(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

async function defaultSleep(delayMs: number) {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
