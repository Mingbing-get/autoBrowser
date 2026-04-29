export interface Point {
  x: number;
  y: number;
}

export interface CoordinateMapping {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
}

export interface ClickController {
  getMapping(tabId: number): CoordinateMapping | undefined;
  setMapping(tabId: number, mapping: CoordinateMapping): void;
  clickAtScreenPoint(point: Point): Promise<void>;
}
