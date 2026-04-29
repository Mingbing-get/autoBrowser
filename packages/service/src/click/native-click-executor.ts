import { createRequire } from "node:module";
import { moveMouseHumanLike, randomOffset, type HumanMouseOptions } from "./human-mouse.js";
import type { ClickController, CoordinateMapping, Point } from "./types.js";

export interface NativeClickExecutorOptions extends HumanMouseOptions {}

interface RobotApi {
  getMousePos(): Point;
  moveMouse(x: number, y: number): void;
  mouseClick(button?: "left" | "right" | "middle", double?: boolean): void;
}

export function createNativeClickExecutor(
  options: NativeClickExecutorOptions = {}
): ClickController {
  const robot = loadRobotApi();
  const mappings = new Map<number, CoordinateMapping>();
  const random = options.random ?? Math.random;

  return {
    getMapping(tabId) {
      return mappings.get(tabId);
    },
    setMapping(tabId, mapping) {
      mappings.set(tabId, mapping);
    },
    async clickAtScreenPoint(point: Point) {
      const target = {
        x: Math.round(point.x + randomOffset(random, 4)),
        y: Math.round(point.y + randomOffset(random, 4))
      };

      await moveMouseHumanLike(robot, target, options);
      robot.mouseClick("left", false);
    }
  };
}

function loadRobotApi(): RobotApi {
  const require = createRequire(import.meta.url);
  return require("robotjs") as RobotApi;
}
