export interface CanvasSize {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface PreviewSize {
  width: number;
  height: number;
  padding: number;
}

export interface TrajectoryPreview extends Omit<PreviewSize, "padding"> {
  path: string;
}

export interface RelativeBounds extends CanvasSize {
  left: number;
  top: number;
}

export interface PointPair {
  start: Point;
  end: Point;
}

export const POINT_MARGIN_PX = 24;
export const MIN_POINT_DISTANCE_PX = 120;
export const POINT_HIT_RADIUS_PX = 18;
export const MAX_RECORDING_DURATION_MS = 10000;

export function createRandomPointPair(
  size: CanvasSize,
  options: { random?: () => number } = {}
): PointPair {
  const random = options.random ?? Math.random;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const start = createRandomPoint(size, random);
    const end = createRandomPoint(size, random);

    if (distanceBetween(start, end) >= MIN_POINT_DISTANCE_PX) {
      return { start, end };
    }
  }

  return {
    start: { x: POINT_MARGIN_PX, y: POINT_MARGIN_PX },
    end: {
      x: Math.max(POINT_MARGIN_PX, size.width - POINT_MARGIN_PX),
      y: Math.max(POINT_MARGIN_PX, size.height - POINT_MARGIN_PX)
    }
  };
}

export function toRelativePoint(
  mouse: { clientX: number; clientY: number },
  bounds: RelativeBounds
): Point | null {
  const x = mouse.clientX - bounds.left;
  const y = mouse.clientY - bounds.top;

  if (x < 0 || y < 0 || x > bounds.width || y > bounds.height) {
    return null;
  }

  return { x, y };
}

export function isPointWithinHitRadius(point: Point, target: Point, radius = POINT_HIT_RADIUS_PX) {
  return distanceBetween(point, target) <= radius;
}

export function buildTrajectoryPreview(
  points: Point[],
  size: PreviewSize
): TrajectoryPreview | null {
  if (!Array.isArray(points) || points.length < 2) {
    return null;
  }

  const finitePoints = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (finitePoints.length < 2) {
    return null;
  }

  const minX = Math.min(...finitePoints.map((point) => point.x));
  const maxX = Math.max(...finitePoints.map((point) => point.x));
  const minY = Math.min(...finitePoints.map((point) => point.y));
  const maxY = Math.max(...finitePoints.map((point) => point.y));

  const usableWidth = Math.max(1, size.width - size.padding * 2);
  const usableHeight = Math.max(1, size.height - size.padding * 2);
  const rangeX = Math.max(1, maxX - minX);
  const rangeY = Math.max(1, maxY - minY);

  const path = finitePoints
    .map((point, index) => {
      const x = size.padding + ((point.x - minX) / rangeX) * usableWidth;
      const y = size.padding + ((point.y - minY) / rangeY) * usableHeight;
      return `${index === 0 ? "M" : "L"} ${formatPreviewNumber(x)} ${formatPreviewNumber(y)}`;
    })
    .join(" ");

  return {
    width: size.width,
    height: size.height,
    path
  };
}

function createRandomPoint(size: CanvasSize, random: () => number): Point {
  const minX = POINT_MARGIN_PX;
  const maxX = Math.max(POINT_MARGIN_PX, size.width - POINT_MARGIN_PX);
  const minY = POINT_MARGIN_PX;
  const maxY = Math.max(POINT_MARGIN_PX, size.height - POINT_MARGIN_PX);

  return {
    x: minX + random() * Math.max(0, maxX - minX),
    y: minY + random() * Math.max(0, maxY - minY)
  };
}

function distanceBetween(from: Point, to: Point) {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function formatPreviewNumber(value: number) {
  return Number.isInteger(value) ? `${value}` : `${Number(value.toFixed(2))}`;
}
