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
  const steps = Math.max(12, Math.min(36, Math.round(distance / 18)));

  for (let index = 1; index <= steps; index += 1) {
    const progress = index / steps;
    const eased = 1 - Math.pow(1 - progress, 2);
    const jitterScale = (1 - progress) * 3;
    const x = Math.round(start.x + dx * eased + randomOffset(random, jitterScale));
    const y = Math.round(start.y + dy * eased + randomOffset(random, jitterScale));
    api.moveMouse(x, y);
    await sleep(4 + Math.floor(random() * 12));
  }

  api.moveMouse(Math.round(target.x), Math.round(target.y));
}

export function randomOffset(random: () => number, magnitude: number) {
  return (random() - 0.5) * 2 * magnitude;
}

async function defaultSleep(delayMs: number) {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
