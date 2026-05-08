import { describe, expect, it, vi } from "vitest";
import { createAutoBrowserService } from "../src/index.js";

async function flushMicrotasks(times = 6) {
  for (let index = 0; index < times; index += 1) {
    await Promise.resolve();
  }
}

function buildDefaultObservation() {
  return {
    primaryEffect: "no-visible-change" as const,
    regions: [],
    meta: {
      durationMs: 0,
      endedBy: "no-change" as const,
      networkEvents: 0,
      meaningfulMutations: 0
    }
  };
}

function handleClickObservationLifecycle(
  service: ReturnType<typeof createAutoBrowserService>,
  message: { command: string; requestId: string },
  tabId: number,
  observation = buildDefaultObservation()
) {
  if (message.command === "clickObserveStart") {
    service.handleIncomingMessage({
      kind: "result",
      requestId: message.requestId,
      ok: true,
      payload: {
        started: true,
        tabId
      }
    });
    return true;
  }

  if (message.command === "clickObserveFinish") {
    service.handleIncomingMessage({
      kind: "result",
      requestId: message.requestId,
      ok: true,
      payload: {
        tabId,
        observation
      }
    });
    return true;
  }

  return false;
}

describe("service", () => {
  it("returns not connected before a browser session is attached", async () => {
    const service = createAutoBrowserService();

    const result = await service.dispatchCommand("open", {
      url: "https://www.baidu.com"
    });

    expect(result).toEqual({
      ok: false,
      error: "browser extension not connected"
    });
  });

  it("forwards a command to the attached transport and resolves the result", async () => {
    const service = createAutoBrowserService();
    let outbound: unknown;

    service.attachTransport({
      send(message) {
        outbound = message;
      }
    });

    const pending = service.dispatchCommand("query", {
      selector: "#id",
      tabId: 9
    });

    expect(outbound).toMatchObject({
      kind: "command",
      command: "query",
      payload: {
        selector: "#id",
        tabId: 9
      }
    });

    const requestId = (outbound as { requestId: string }).requestId;
    service.handleIncomingMessage({
      kind: "result",
      requestId,
      ok: true,
      payload: {
        found: true,
        text: "hello"
      }
    });

    await expect(pending).resolves.toEqual({
      ok: true,
      payload: {
        found: true,
        text: "hello"
      }
    });
  });

  it("reports connection state", () => {
    const service = createAutoBrowserService();

    expect(service.getStatus()).toEqual({
      connected: false,
      pendingRequests: 0
    });

    service.attachTransport({
      send() {}
    });

    expect(service.getStatus()).toEqual({
      connected: true,
      pendingRequests: 0
    });
  });

  it("forwards a summary command through the same transport", async () => {
    const service = createAutoBrowserService();
    let outbound: unknown;

    service.attachTransport({
      send(message) {
        outbound = message;
      }
    });

    const pending = service.dispatchCommand("summary", {});

    expect(outbound).toMatchObject({
      kind: "command",
      command: "summary",
      payload: {}
    });

    const requestId = (outbound as { requestId: string }).requestId;
    service.handleIncomingMessage({
      kind: "result",
      requestId,
      ok: true,
      payload: {
        title: "Demo"
      }
    });

    await expect(pending).resolves.toEqual({
      ok: true,
      payload: {
        title: "Demo"
      }
    });
  });

  it("lists stored mouse trajectories without needing a browser transport", async () => {
    const service = createAutoBrowserService({
      trajectoryRepository: {
        async list() {
          return [
            {
              id: "traj_1",
              createdAt: "2026-05-08T10:00:00.000Z",
              durationMs: 28,
              sourceDistance: 90,
              pointCount: 3,
              points: [
                { x: 0, y: 0, t: 0 },
                { x: 30, y: 16, t: 14 },
                { x: 90, y: 0, t: 28 }
              ]
            }
          ];
        },
        async create() {
          throw new Error("not used");
        },
        async delete() {
          throw new Error("not used");
        },
        async getRandom() {
          return undefined;
        }
      }
    });

    await expect(service.dispatchCommand("mouseTrajectoryList", {})).resolves.toEqual({
      ok: true,
      payload: {
        trajectories: [
          {
            id: "traj_1",
            createdAt: "2026-05-08T10:00:00.000Z",
            durationMs: 28,
            sourceDistance: 90,
            pointCount: 3,
            points: [
              { x: 0, y: 0, t: 0 },
              { x: 30, y: 16, t: 14 },
              { x: 90, y: 0, t: 28 }
            ]
          }
        ]
      }
    });
  });

  it("creates and deletes mouse trajectories through the local repository", async () => {
    const created = {
      id: "traj_2",
      createdAt: "2026-05-08T11:00:00.000Z",
      durationMs: 20,
      sourceDistance: 60,
      pointCount: 2,
      points: [
        { x: 0, y: 0, t: 0 },
        { x: 60, y: 0, t: 20 }
      ]
    };
    const repository = {
      async list() {
        return [created];
      },
      async create(payload: { points: Array<{ x: number; y: number; t: number }> }) {
        expect(payload.points).toEqual([
          { x: 100, y: 100, t: 0 },
          { x: 160, y: 100, t: 20 }
        ]);
        return created;
      },
      async delete(id: string) {
        expect(id).toBe("traj_2");
        return true;
      },
      async getRandom() {
        return undefined;
      }
    };
    const service = createAutoBrowserService({
      trajectoryRepository: repository
    });

    await expect(service.dispatchCommand("mouseTrajectoryCreate", {
      points: [
        { x: 100, y: 100, t: 0 },
        { x: 160, y: 100, t: 20 }
      ]
    })).resolves.toEqual({
      ok: true,
      payload: {
        trajectory: {
          id: "traj_2",
          createdAt: "2026-05-08T11:00:00.000Z",
          durationMs: 20,
          sourceDistance: 60,
          pointCount: 2
        }
      }
    });

    await expect(service.dispatchCommand("mouseTrajectoryDelete", {
      id: "traj_2"
    })).resolves.toEqual({
      ok: true,
      payload: {
        deleted: true,
        id: "traj_2"
      }
    });
  });

  it("forwards a search command through the same transport", async () => {
    const service = createAutoBrowserService();
    let outbound: unknown;

    service.attachTransport({
      send(message) {
        outbound = message;
      }
    });

    const pending = service.dispatchCommand("search", {
      text: "Search now"
    });

    expect(outbound).toMatchObject({
      kind: "command",
      command: "search",
      payload: {
        text: "Search now"
      }
    });

    const requestId = (outbound as { requestId: string }).requestId;
    service.handleIncomingMessage({
      kind: "result",
      requestId,
      ok: true,
      payload: {
        found: true,
        matches: [
          {
            selector: "#search-button",
            tag: "button",
            text: "Search now",
            visible: true
          }
        ],
        meta: {
          query: "Search now",
          limit: 20,
          totalMatches: 1,
          truncated: false
        }
      }
    });

    await expect(pending).resolves.toEqual({
      ok: true,
      payload: {
        found: true,
        matches: [
          {
            selector: "#search-button",
            tag: "button",
            text: "Search now",
            visible: true
          }
        ],
        meta: {
          query: "Search now",
          limit: 20,
          totalMatches: 1,
          truncated: false
        }
      }
    });
  });

  it("forwards a text command through the same transport", async () => {
    const service = createAutoBrowserService();
    let outbound: unknown;

    service.attachTransport({
      send(message) {
        outbound = message;
      }
    });

    const pending = service.dispatchCommand("text", {
      selector: "#s-hotsearch-wrapper"
    });

    expect(outbound).toMatchObject({
      kind: "command",
      command: "text",
      payload: {
        selector: "#s-hotsearch-wrapper"
      }
    });

    const requestId = (outbound as { requestId: string }).requestId;
    service.handleIncomingMessage({
      kind: "result",
      requestId,
      ok: true,
      payload: {
        text: "full page text"
      }
    });

    await expect(pending).resolves.toEqual({
      ok: true,
      payload: {
        text: "full page text"
      }
    });
  });

  it("orchestrates click with extension observation and native clicking", async () => {
    const focusBrowserWindow = vi.fn().mockResolvedValue(undefined);
    const clickAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const service = createAutoBrowserService({
      clickController: {
        getMapping() {
          return {
            scaleX: 1,
            scaleY: 1,
            offsetX: 100,
            offsetY: 80
          };
        },
        setMapping() {
          throw new Error("should not recalibrate when mapping is cached");
        },
        focusBrowserWindow,
        clickAtScreenPoint
      }
    });
    const outboundCommands: string[] = [];

    service.attachTransport({
      send(message) {
        outboundCommands.push(message.command);

        if (message.command === "clickObserveStart") {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              started: true,
              tabId: 8
            }
          });
          return;
        }

        if (message.command === "rect") {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              found: true,
              viewport: {
                innerWidth: 1280,
                innerHeight: 720,
                scrollX: 0,
                scrollY: 0
              },
              rect: {
                x: 20,
                y: 40,
                top: 40,
                left: 20,
                right: 120,
                bottom: 100,
                width: 100,
                height: 60,
                scrollWidth: 180,
                scrollHeight: 260
              },
              scrollableAncestors: []
            }
          });
          return;
        }

        if (message.command === "clickObserveFinish") {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              tabId: 8,
              observation: {
                primaryEffect: "overlay",
                regions: [],
                meta: {
                  durationMs: 220,
                  endedBy: "stabilized",
                  networkEvents: 0,
                  meaningfulMutations: 2
                }
              }
            }
          });
        }
      }
    });

    const result = await service.dispatchCommand("click", {
      selector: "#search-trigger",
      tabId: 8,
      observe: {
        stableWindowMs: 240
      }
    });

    expect(outboundCommands).toEqual(["clickObserveStart", "rect", "clickObserveFinish"]);
    expect(focusBrowserWindow).toHaveBeenCalledWith(8);
    expect(clickAtScreenPoint).toHaveBeenCalledOnce();
    expect(result).toEqual({
      ok: true,
      payload: {
        clicked: true,
        tabId: 8,
        observation: {
          primaryEffect: "overlay",
          regions: [],
          meta: {
            durationMs: 220,
            endedBy: "stabilized",
            networkEvents: 0,
            meaningfulMutations: 2
          }
        }
      }
    });
  });

  it("orchestrates hover with extension observation and native mouse movement", async () => {
    const focusBrowserWindow = vi.fn().mockResolvedValue(undefined);
    const moveMouseToScreenPoint = vi.fn().mockResolvedValue(undefined);
    const clickAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const service = createAutoBrowserService({
      clickController: {
        getMapping() {
          return {
            scaleX: 1,
            scaleY: 1,
            offsetX: 100,
            offsetY: 80
          };
        },
        setMapping() {
          throw new Error("should not recalibrate when mapping is cached");
        },
        focusBrowserWindow,
        moveMouseToScreenPoint,
        clickAtScreenPoint
      }
    });
    const outboundCommands: string[] = [];

    service.attachTransport({
      send(message) {
        outboundCommands.push(message.command);

        if (message.command === "clickObserveStart") {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              started: true,
              tabId: 8
            }
          });
          return;
        }

        if (message.command === "rect") {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              found: true,
              viewport: {
                innerWidth: 1280,
                innerHeight: 720,
                scrollX: 0,
                scrollY: 0
              },
              rect: {
                x: 20,
                y: 40,
                top: 40,
                left: 20,
                right: 120,
                bottom: 100,
                width: 100,
                height: 60,
                scrollWidth: 180,
                scrollHeight: 260
              },
              scrollableAncestors: []
            }
          });
          return;
        }

        if (message.command === "clickObserveFinish") {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              tabId: 8,
              observation: {
                primaryEffect: "overlay",
                regions: [],
                meta: {
                  durationMs: 160,
                  endedBy: "stabilized",
                  networkEvents: 0,
                  meaningfulMutations: 1
                }
              }
            }
          });
        }
      }
    });

    const result = await service.dispatchCommand("hover", {
      selector: "#menu-trigger",
      tabId: 8,
      observe: {
        stableWindowMs: 240
      }
    });

    expect(outboundCommands).toEqual(["clickObserveStart", "rect", "clickObserveFinish"]);
    expect(focusBrowserWindow).toHaveBeenCalledWith(8);
    expect(moveMouseToScreenPoint).toHaveBeenCalledOnce();
    expect(clickAtScreenPoint).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      payload: {
        hovered: true,
        tabId: 8,
        observation: {
          primaryEffect: "overlay",
          regions: [],
          meta: {
            durationMs: 160,
            endedBy: "stabilized",
            networkEvents: 0,
            meaningfulMutations: 1
          }
        }
      }
    });
  });

  it("orchestrates drag with a target selector anchor and returns an observation", async () => {
    const focusBrowserWindow = vi.fn().mockResolvedValue(undefined);
    const mouseDownAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const moveMouseToScreenPoint = vi.fn().mockResolvedValue(undefined);
    const mouseUp = vi.fn().mockResolvedValue(undefined);
    const service = createAutoBrowserService({
      clickController: {
        getMapping() {
          return {
            scaleX: 1,
            scaleY: 1,
            offsetX: 100,
            offsetY: 80
          };
        },
        setMapping() {
          throw new Error("should not recalibrate when mapping is cached");
        },
        focusBrowserWindow,
        clickAtScreenPoint: vi.fn().mockResolvedValue(undefined),
        mouseDownAtScreenPoint,
        moveMouseToScreenPoint,
        mouseUp
      } as never
    });
    const outboundCommands: string[] = [];

    service.attachTransport({
      send(message) {
        outboundCommands.push(message.command);

        if (message.command === "clickObserveStart") {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              started: true,
              tabId: 8
            }
          });
          return;
        }

        if (message.command === "rect") {
          const selector = (message.payload as { selector: string }).selector;
          if (selector === "#card") {
            service.handleIncomingMessage({
              kind: "result",
              requestId: message.requestId,
              ok: true,
              payload: {
                found: true,
                viewport: {
                  innerWidth: 1280,
                  innerHeight: 720,
                  scrollX: 0,
                  scrollY: 0
                },
                rect: {
                  x: 20,
                  y: 40,
                  top: 40,
                  left: 20,
                  right: 120,
                  bottom: 100,
                  width: 100,
                  height: 60,
                  scrollWidth: 100,
                  scrollHeight: 60
                },
                scrollableAncestors: []
              }
            });
            return;
          }

          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              found: true,
              viewport: {
                innerWidth: 1280,
                innerHeight: 720,
                scrollX: 0,
                scrollY: 0
              },
              rect: {
                x: 260,
                y: 200,
                top: 200,
                left: 260,
                right: 360,
                bottom: 280,
                width: 100,
                height: 80,
                scrollWidth: 100,
                scrollHeight: 80
              },
              scrollableAncestors: []
            }
          });
          return;
        }

        if (message.command === "clickObserveFinish") {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              tabId: 8,
              observation: {
                primaryEffect: "selection-change",
                regions: [],
                meta: {
                  durationMs: 260,
                  endedBy: "stabilized",
                  networkEvents: 0,
                  meaningfulMutations: 1
                }
              }
            }
          });
        }
      }
    });

    const result = await service.dispatchCommand("drag", {
      selector: "#card",
      targetSelector: "#dropzone",
      direction: "br",
      tabId: 8
    });

    expect(outboundCommands).toEqual(["clickObserveStart", "rect", "rect", "clickObserveFinish"]);
    expect(focusBrowserWindow).toHaveBeenCalledWith(8);
    expect(mouseDownAtScreenPoint).toHaveBeenCalledWith({
      x: 172,
      y: 148.8
    });
    expect(moveMouseToScreenPoint).toHaveBeenCalledWith({
      x: 460,
      y: 360
    });
    expect(mouseUp).toHaveBeenCalledOnce();
    expect(result).toEqual({
      ok: true,
      payload: {
        dragged: true,
        tabId: 8,
        targetPoint: {
          x: 360,
          y: 280
        },
        observation: {
          primaryEffect: "selection-change",
          regions: [],
          meta: {
            durationMs: 260,
            endedBy: "stabilized",
            networkEvents: 0,
            meaningfulMutations: 1
          }
        }
      }
    });
  });

  it("drags to viewport coordinates and keeps the observation flow", async () => {
    const focusBrowserWindow = vi.fn().mockResolvedValue(undefined);
    const mouseDownAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const moveMouseToScreenPoint = vi.fn().mockResolvedValue(undefined);
    const mouseUp = vi.fn().mockResolvedValue(undefined);
    const service = createAutoBrowserService({
      clickController: {
        getMapping() {
          return {
            scaleX: 1,
            scaleY: 1,
            offsetX: 100,
            offsetY: 80
          };
        },
        setMapping() {
          throw new Error("should not recalibrate when mapping is cached");
        },
        focusBrowserWindow,
        clickAtScreenPoint: vi.fn().mockResolvedValue(undefined),
        mouseDownAtScreenPoint,
        moveMouseToScreenPoint,
        mouseUp
      } as never
    });
    const outboundCommands: string[] = [];

    service.attachTransport({
      send(message) {
        outboundCommands.push(message.command);

        if (message.command === "clickObserveStart") {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              started: true,
              tabId: 8
            }
          });
          return;
        }

        if (message.command === "rect") {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              found: true,
              viewport: {
                innerWidth: 1280,
                innerHeight: 720,
                scrollX: 0,
                scrollY: 0
              },
              rect: {
                x: 20,
                y: 40,
                top: 40,
                left: 20,
                right: 120,
                bottom: 100,
                width: 100,
                height: 60,
                scrollWidth: 100,
                scrollHeight: 60
              },
              scrollableAncestors: []
            }
          });
          return;
        }

        if (message.command === "clickObserveFinish") {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              tabId: 8,
              observation: {
                primaryEffect: "selection-change",
                regions: [],
                meta: {
                  durationMs: 180,
                  endedBy: "stabilized",
                  networkEvents: 0,
                  meaningfulMutations: 1
                }
              }
            }
          });
        }
      }
    });

    const result = await service.dispatchCommand("drag", {
      selector: "#card",
      x: 320,
      y: 240,
      tabId: 8
    });

    expect(outboundCommands).toEqual(["clickObserveStart", "rect", "rect", "clickObserveFinish"]);
    expect(mouseDownAtScreenPoint).toHaveBeenCalledWith({
      x: 172,
      y: 148.8
    });
    expect(moveMouseToScreenPoint).toHaveBeenCalledWith({
      x: 420,
      y: 320
    });
    expect(mouseUp).toHaveBeenCalledOnce();
    expect(result).toEqual({
      ok: true,
      payload: {
        dragged: true,
        tabId: 8,
        targetPoint: {
          x: 320,
          y: 240
        },
        observation: {
          primaryEffect: "selection-change",
          regions: [],
          meta: {
            durationMs: 180,
            endedBy: "stabilized",
            networkEvents: 0,
            meaningfulMutations: 1
          }
        }
      }
    });
  });

  it("fails drag when viewport coordinates fall outside the visible viewport", async () => {
    const focusBrowserWindow = vi.fn().mockResolvedValue(undefined);
    const mouseDownAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const moveMouseToScreenPoint = vi.fn().mockResolvedValue(undefined);
    const mouseUp = vi.fn().mockResolvedValue(undefined);
    const service = createAutoBrowserService({
      clickController: {
        getMapping() {
          return {
            scaleX: 1,
            scaleY: 1,
            offsetX: 100,
            offsetY: 80
          };
        },
        setMapping() {
          throw new Error("should not recalibrate when mapping is cached");
        },
        focusBrowserWindow,
        clickAtScreenPoint: vi.fn().mockResolvedValue(undefined),
        mouseDownAtScreenPoint,
        moveMouseToScreenPoint,
        mouseUp
      } as never
    });

    service.attachTransport({
      send(message) {
        if (message.command === "clickObserveStart") {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              started: true,
              tabId: 8
            }
          });
          return;
        }

        if (message.command === "rect") {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              found: true,
              viewport: {
                innerWidth: 1280,
                innerHeight: 720,
                scrollX: 0,
                scrollY: 0
              },
              rect: {
                x: 20,
                y: 40,
                top: 40,
                left: 20,
                right: 120,
                bottom: 100,
                width: 100,
                height: 60,
                scrollWidth: 100,
                scrollHeight: 60
              },
              scrollableAncestors: []
            }
          });
        }
      }
    });

    const result = await service.dispatchCommand("drag", {
      selector: "#card",
      x: 1600,
      y: 900,
      tabId: 8
    });

    expect(result).toEqual({
      ok: false,
      error: "drag target is outside the viewport: (1600, 900)"
    });
    expect(mouseDownAtScreenPoint).not.toHaveBeenCalled();
    expect(moveMouseToScreenPoint).not.toHaveBeenCalled();
    expect(mouseUp).not.toHaveBeenCalled();
  });

  it("forwards a close command through the same transport", async () => {
    const service = createAutoBrowserService();
    let outbound: unknown;

    service.attachTransport({
      send(message) {
        outbound = message;
      }
    });

    const pending = service.dispatchCommand("close", {
      tabId: 5
    });

    expect(outbound).toMatchObject({
      kind: "command",
      command: "close",
      payload: {
        tabId: 5
      }
    });

    const requestId = (outbound as { requestId: string }).requestId;
    service.handleIncomingMessage({
      kind: "result",
      requestId,
      ok: true,
      payload: {
        tabId: 5
      }
    });

    await expect(pending).resolves.toEqual({
      ok: true,
      payload: {
        tabId: 5
      }
    });
  });

  it("forwards a tabs command through the same transport", async () => {
    const service = createAutoBrowserService();
    let outbound: unknown;

    service.attachTransport({
      send(message) {
        outbound = message;
      }
    });

    const pending = service.dispatchCommand("tabs", {});

    expect(outbound).toMatchObject({
      kind: "command",
      command: "tabs",
      payload: {}
    });

    const requestId = (outbound as { requestId: string }).requestId;
    service.handleIncomingMessage({
      kind: "result",
      requestId,
      ok: true,
      payload: [
        {
          tabId: 5,
          url: "https://example.com",
          title: "Example",
          active: true
        }
      ]
    });

    await expect(pending).resolves.toEqual({
      ok: true,
      payload: [
        {
          tabId: 5,
          url: "https://example.com",
          title: "Example",
          active: true
        }
      ]
    });
  });

  it("forwards a rect command through the same transport", async () => {
    const service = createAutoBrowserService();
    let outbound: unknown;

    service.attachTransport({
      send(message) {
        outbound = message;
      }
    });

    const pending = service.dispatchCommand("rect", {
      selector: "#card",
      tabId: 8
    });

    expect(outbound).toMatchObject({
      kind: "command",
      command: "rect",
      payload: {
        selector: "#card",
        tabId: 8
      }
    });

    const requestId = (outbound as { requestId: string }).requestId;
    service.handleIncomingMessage({
      kind: "result",
      requestId,
      ok: true,
      payload: {
        found: true,
        viewport: {
          innerWidth: 1280,
          innerHeight: 720,
          scrollX: 0,
          scrollY: 300
        },
        rect: {
          x: 12,
          y: 16,
          top: 16,
          left: 12,
          right: 112,
          bottom: 56,
          width: 100,
          height: 40,
          scrollWidth: 140,
          scrollHeight: 220
        },
        scrollableAncestors: []
      }
    });

    await expect(pending).resolves.toEqual({
      ok: true,
      payload: {
        found: true,
        viewport: {
          innerWidth: 1280,
          innerHeight: 720,
          scrollX: 0,
          scrollY: 300
        },
        rect: {
          x: 12,
          y: 16,
          top: 16,
          left: 12,
          right: 112,
          bottom: 56,
          width: 100,
          height: 40,
          scrollWidth: 140,
          scrollHeight: 220
        },
        scrollableAncestors: []
      }
    });
  });

  it("executes flow steps in order and waits between successful non-final steps", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const service = createAutoBrowserService({
      getFlowDelayMs: () => 800,
      sleep
    });
    const outbound: Array<{ requestId: string; command: string; payload: unknown }> = [];

    service.attachTransport({
      send(message) {
        outbound.push(message as { requestId: string; command: string; payload: unknown });
      }
    });

    const pending = service.dispatchCommand("flow", {
      steps: [
        {
          action: "open",
          url: "https://example.com"
        },
        {
          action: "query",
          selector: "#result"
        }
      ]
    });

    expect(outbound[0]).toMatchObject({
      command: "open",
      payload: {
        url: "https://example.com"
      }
    });

    service.handleIncomingMessage({
      kind: "result",
      requestId: outbound[0]?.requestId,
      ok: true,
      payload: {
        url: "https://example.com"
      }
    });

    await flushMicrotasks();

    expect(sleep).toHaveBeenCalledWith(800);
    expect(outbound[1]).toMatchObject({
      command: "query",
      payload: {
        selector: "#result"
      }
    });

    service.handleIncomingMessage({
      kind: "result",
      requestId: outbound[1]?.requestId,
      ok: true,
      payload: {
        found: true
      }
    });

    await expect(pending).resolves.toEqual({
      ok: true,
      payload: {
        results: [
          {
            index: 0,
            action: "open",
            ok: true,
            payload: {
              url: "https://example.com"
            }
          },
          {
            index: 1,
            action: "query",
            ok: true,
            payload: {
              found: true
            }
          }
        ]
      }
    });
  });

  it("supports the extended flow action set", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const focusBrowserWindow = vi.fn().mockResolvedValue(undefined);
    const clickAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const scrollAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const service = createAutoBrowserService({
      getFlowDelayMs: () => 600,
      sleep,
      clickController: {
        focusBrowserWindow,
        clickAtScreenPoint,
        scrollAtScreenPoint,
        getMapping(tabId) {
          expect(tabId).toBe(8);
          return {
            scaleX: 1,
            scaleY: 1,
            offsetX: 100,
            offsetY: 80
          };
        },
        setMapping() {}
      }
    });
    const outbound: Array<{ requestId: string; command: string; payload: unknown }> = [];

    service.attachTransport({
      send(message) {
        outbound.push(message as { requestId: string; command: string; payload: unknown });
      }
    });

    const pending = service.dispatchCommand("flow", {
      steps: [
        {
          action: "tabs"
        },
        {
          action: "search",
          text: "Search now"
        },
        {
          action: "search-from-point",
          x: 120,
          y: 84,
          tabId: 8
        },
        {
          action: "rect",
          selector: "#submit",
          tabId: 8
        },
        {
          action: "click",
          selector: "#submit",
          tabId: 8,
          observe: {
            maxObserveMs: 1200
          }
        },
        {
          action: "scroll",
          deltaX: 0,
          deltaY: 240,
          tabId: 8
        },
        {
          action: "close",
          tabId: 8
        }
      ]
    });

    expect(outbound[0]).toMatchObject({
      command: "tabs",
      payload: {}
    });

    service.handleIncomingMessage({
      kind: "result",
      requestId: outbound[0]?.requestId,
      ok: true,
      payload: [
        {
          tabId: 8,
          url: "https://example.com",
          title: "Example",
          active: true
        }
      ]
    });

    await flushMicrotasks();
    expect(outbound[1]).toMatchObject({
      command: "search",
      payload: {
        text: "Search now"
      }
    });

    service.handleIncomingMessage({
      kind: "result",
      requestId: outbound[1]?.requestId,
      ok: true,
      payload: {
        found: true,
        matches: [],
        meta: {
          query: "Search now",
          limit: 20,
          totalMatches: 0,
          truncated: false
        }
      }
    });

    await flushMicrotasks();
    expect(outbound[2]).toMatchObject({
      command: "searchFromPoint",
      payload: {
        x: 120,
        y: 84,
        tabId: 8
      }
    });

    service.handleIncomingMessage({
      kind: "result",
      requestId: outbound[2]?.requestId,
      ok: true,
      payload: {
        found: true,
        x: 120,
        y: 84,
        matches: []
      }
    });

    await flushMicrotasks();
    expect(outbound[3]).toMatchObject({
      command: "rect",
      payload: {
        selector: "#submit",
        tabId: 8
      }
    });

    service.handleIncomingMessage({
      kind: "result",
      requestId: outbound[3]?.requestId,
      ok: true,
      payload: {
        found: true,
        viewport: {
          innerWidth: 800,
          innerHeight: 600,
          scrollX: 0,
          scrollY: 0
        },
        rect: {
          x: 12,
          y: 16,
          top: 16,
          left: 12,
          right: 112,
          bottom: 56,
          width: 100,
          height: 40,
          scrollWidth: 100,
          scrollHeight: 40
        },
        scrollableAncestors: []
      }
    });

    await flushMicrotasks();
    expect(outbound[4]).toMatchObject({
      command: "clickObserveStart",
      payload: {
        selector: "#submit",
        tabId: 8,
        observe: {
          maxObserveMs: 1200
        }
      }
    });

    service.handleIncomingMessage({
      kind: "result",
      requestId: outbound[4]?.requestId,
      ok: true,
      payload: {
        started: true,
        tabId: 8
      }
    });

    await flushMicrotasks();
    expect(outbound[5]).toMatchObject({
      command: "rect",
      payload: {
        selector: "#submit",
        tabId: 8
      }
    });

    service.handleIncomingMessage({
      kind: "result",
      requestId: outbound[5]?.requestId,
      ok: true,
      payload: {
        found: true,
        viewport: {
          innerWidth: 800,
          innerHeight: 600,
          scrollX: 0,
          scrollY: 0
        },
        rect: {
          x: 12,
          y: 16,
          top: 16,
          left: 12,
          right: 112,
          bottom: 56,
          width: 100,
          height: 40,
          scrollWidth: 100,
          scrollHeight: 40
        },
        scrollableAncestors: []
      }
    });

    await flushMicrotasks();
    expect(outbound[6]).toMatchObject({
      command: "clickObserveFinish",
      payload: {
        tabId: 8,
        awaitStability: true,
        observe: {
          maxObserveMs: 1200
        }
      }
    });

    service.handleIncomingMessage({
      kind: "result",
      requestId: outbound[6]?.requestId,
      ok: true,
      payload: {
        tabId: 8,
        observation: {
          primaryEffect: "no-visible-change",
          regions: [],
          meta: {
            durationMs: 250,
            endedBy: "stabilized",
            networkEvents: 0,
            meaningfulMutations: 0
          }
        }
      }
    });

    await flushMicrotasks(12);
    expect(outbound[7]).toMatchObject({
      command: "scroll",
      payload: {
        deltaX: 0,
        deltaY: 240,
        tabId: 8
      }
    });
    expect(focusBrowserWindow).toHaveBeenCalledWith(8);

    service.handleIncomingMessage({
      kind: "result",
      requestId: outbound[7]?.requestId,
      ok: true,
      payload: {
        acknowledged: true
      }
    });

    await flushMicrotasks(12);
    expect(scrollAtScreenPoint).toHaveBeenCalledWith({
      x: 0,
      y: 240
    });
    expect(outbound[8]).toMatchObject({
      command: "close",
      payload: {
        tabId: 8
      }
    });

    service.handleIncomingMessage({
      kind: "result",
      requestId: outbound[8]?.requestId,
      ok: true,
      payload: {
        tabId: 8
      }
    });

    await expect(pending).resolves.toMatchObject({
      ok: true,
      payload: {
        results: [
          {
            index: 0,
            action: "tabs",
            ok: true
          },
          {
            index: 1,
            action: "search",
            ok: true
          },
          {
            index: 2,
            action: "search-from-point",
            ok: true
          },
          {
            index: 3,
            action: "rect",
            ok: true
          },
          {
            index: 4,
            action: "click",
            ok: true
          },
          {
            index: 5,
            action: "scroll",
            ok: true
          },
          {
            index: 6,
            action: "close",
            ok: true
          }
        ]
      }
    });
    expect(sleep).toHaveBeenCalledWith(600);
  });

  it("supports upload steps inside flow", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const focusBrowserWindow = vi.fn().mockResolvedValue(undefined);
    const clickAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const uploadFile = vi.fn().mockResolvedValue({
      uploaded: true,
      strategy: "native-dialog"
    });
    const service = createAutoBrowserService({
      getFlowDelayMs: () => 600,
      sleep,
      clickController: {
        focusBrowserWindow,
        clickAtScreenPoint,
        getMapping(tabId) {
          expect(tabId).toBe(8);
          return {
            scaleX: 1,
            scaleY: 1,
            offsetX: 100,
            offsetY: 80
          };
        },
        setMapping() {}
      },
      keyboardController: {
        typeText: vi.fn(),
        uploadFile
      }
    });
    const outbound: Array<{ requestId: string; command: string; payload: unknown }> = [];

    service.attachTransport({
      send(message) {
        outbound.push(message as { requestId: string; command: string; payload: unknown });
      }
    });

    const pending = service.dispatchCommand("flow", {
      steps: [
        {
          action: "upload",
          selector: "#upload",
          filepath: "/tmp/report.pdf",
          tabId: 8
        },
        {
          action: "close",
          tabId: 8
        }
      ]
    });

    await flushMicrotasks();
    expect(outbound[0]).toMatchObject({
      command: "rect",
      payload: {
        selector: "#upload",
        tabId: 8
      }
    });

    service.handleIncomingMessage({
      kind: "result",
      requestId: outbound[0]?.requestId,
      ok: true,
      payload: {
        found: true,
        viewport: {
          innerWidth: 800,
          innerHeight: 600,
          scrollX: 0,
          scrollY: 0
        },
        rect: {
          x: 36,
          y: 52,
          top: 52,
          left: 36,
          right: 156,
          bottom: 92,
          width: 120,
          height: 40,
          scrollWidth: 120,
          scrollHeight: 40
        },
        scrollableAncestors: []
      }
    });

    await flushMicrotasks();
    await flushMicrotasks();

    expect(focusBrowserWindow).toHaveBeenCalledWith(8);
    expect(clickAtScreenPoint).toHaveBeenCalledTimes(1);
    expect(uploadFile).toHaveBeenCalledWith("/tmp/report.pdf");
    expect(outbound[1]).toMatchObject({
      command: "close",
      payload: {
        tabId: 8
      }
    });

    service.handleIncomingMessage({
      kind: "result",
      requestId: outbound[1]?.requestId,
      ok: true,
      payload: {
        tabId: 8
      }
    });

    await expect(pending).resolves.toMatchObject({
      ok: true,
      payload: {
        results: [
          {
            index: 0,
            action: "upload",
            ok: true,
            payload: {
              uploaded: true,
              tabId: 8,
              strategy: "native-dialog"
            }
          },
          {
            index: 1,
            action: "close",
            ok: true,
            payload: {
              tabId: 8
            }
          }
        ]
      }
    });
  });

  it("stops flow execution when a step fails", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const service = createAutoBrowserService({
      getFlowDelayMs: () => 1250,
      sleep
    });
    const outbound: Array<{ requestId: string; command: string; payload: unknown }> = [];

    service.attachTransport({
      send(message) {
        outbound.push(message as { requestId: string; command: string; payload: unknown });
      }
    });

    const pending = service.dispatchCommand("flow", {
      steps: [
        {
          action: "open",
          url: "https://example.com"
        },
        {
          action: "text",
          selector: "#missing"
        },
        {
          action: "summary"
        }
      ]
    });

    service.handleIncomingMessage({
      kind: "result",
      requestId: outbound[0]?.requestId,
      ok: true,
      payload: {
        url: "https://example.com"
      }
    });

    await flushMicrotasks();

    expect(outbound[1]).toMatchObject({
      command: "text",
      payload: {
        selector: "#missing"
      }
    });

    service.handleIncomingMessage({
      kind: "result",
      requestId: outbound[1]?.requestId,
      ok: false,
      error: "selector not found: #missing"
    });

    await expect(pending).resolves.toEqual({
      ok: false,
      error: "selector not found: #missing",
      payload: {
        failedIndex: 1,
        results: [
          {
            index: 0,
            action: "open",
            ok: true,
            payload: {
              url: "https://example.com"
            }
          },
          {
            index: 1,
            action: "text",
            ok: false,
            error: "selector not found: #missing"
          }
        ]
      }
    });
    expect(outbound).toHaveLength(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("orchestrates a click with an existing tab mapping", async () => {
    const focusBrowserWindow = vi.fn().mockResolvedValue(undefined);
    const clickAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const service = createAutoBrowserService({
      clickController: {
        getMapping(tabId) {
          expect(tabId).toBe(8);
          return {
            scaleX: 1,
            scaleY: 1,
            offsetX: 100,
            offsetY: 80
          };
        },
        setMapping() {
          throw new Error("should not recalibrate when mapping is cached");
        },
        focusBrowserWindow,
        clickAtScreenPoint
      }
    });
    const outboundCommands: string[] = [];

    service.attachTransport({
      send(message) {
        outboundCommands.push(message.command);

        if (handleClickObservationLifecycle(service, message, 8)) {
          return;
        }

        if (message.command === "rect") {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              found: true,
              viewport: {
                innerWidth: 1280,
                innerHeight: 720,
                scrollX: 0,
                scrollY: 0
              },
              rect: {
                x: 20,
                y: 40,
                top: 40,
                left: 20,
                right: 120,
                bottom: 100,
                width: 100,
                height: 60,
                scrollWidth: 180,
                scrollHeight: 260
              },
              scrollableAncestors: []
            }
          });
        }
      }
    });

    const result = await service.dispatchCommand("click", {
      selector: "#card",
      tabId: 8
    });

    expect(outboundCommands).toEqual(["clickObserveStart", "rect", "clickObserveFinish"]);
    expect(focusBrowserWindow).toHaveBeenCalledWith(8);
    expect(clickAtScreenPoint).toHaveBeenCalledOnce();
    expect(result).toEqual({
      ok: true,
      payload: {
        clicked: true,
        tabId: 8,
        observation: buildDefaultObservation()
      }
    });
  });

  it("calibrates before clicking when a tab mapping is missing", async () => {
    const focusBrowserWindow = vi.fn(async () => {
      lifecycle.push("focus");
    });
    const calibrationTargets: Array<{ x: number; y: number }> = [];
    const clickTargets: Array<{ x: number; y: number }> = [];
    const mappingWrites: Array<{ tabId: number; mapping: unknown }> = [];
    const lifecycle: string[] = [];
    const service = createAutoBrowserService({
      clickController: {
        getMapping() {
          return undefined;
        },
        setMapping(tabId, mapping) {
          mappingWrites.push({ tabId, mapping });
        },
        focusBrowserWindow,
        async clickAtScreenPoint(point) {
          if (calibrationTargets.length < 2) {
            lifecycle.push("calibration-click");
            calibrationTargets.push(point);
            return;
          }

          lifecycle.push("final-click");
          clickTargets.push(point);
        }
      }
    });
    const outboundCommands: string[] = [];

    service.attachTransport({
      send(message) {
        outboundCommands.push(message.command);

        if (handleClickObservationLifecycle(service, message, 5)) {
          return;
        }

        if (message.command === "tabs") {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: [
              {
                tabId: 5,
                url: "https://example.com",
                title: "Example",
                active: true
              }
            ]
          });
          return;
        }

        if (message.command === "clickMapStart") {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              tabId: 5,
              rect: {
                left: 0,
                top: 0,
                width: 1200,
                height: 800
              },
              window: {
                screenLeft: 100,
                screenTop: 50,
                innerWidth: 1200,
                innerHeight: 800,
                outerWidth: 1216,
                outerHeight: 920,
                devicePixelRatio: 2
              },
              zoom: 1.5
            }
          });
          return;
        }

        if (message.command === "clickMapFinish") {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              tabId: 5,
              points: [
                { x: 120, y: 180 },
                { x: 860, y: 620 }
              ]
            }
          });
          return;
        }

        if (message.command === "rect") {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              found: true,
              viewport: {
                innerWidth: 1280,
                innerHeight: 720,
                scrollX: 0,
                scrollY: 0
              },
              rect: {
                x: 200,
                y: 300,
                top: 300,
                left: 200,
                right: 320,
                bottom: 360,
                width: 120,
                height: 60,
                scrollWidth: 240,
                scrollHeight: 420
              },
              scrollableAncestors: []
            }
          });
        }
      }
    });

    const result = await service.dispatchCommand("click", {
      selector: "#card"
    });

    expect(outboundCommands).toEqual([
      "tabs",
      "clickObserveStart",
      "clickMapStart",
      "clickMapFinish",
      "rect",
      "clickObserveFinish"
    ]);
    expect(focusBrowserWindow).toHaveBeenCalledWith(5);
    expect(lifecycle.indexOf("focus")).toBeLessThan(lifecycle.indexOf("calibration-click"));
    expect(calibrationTargets).toEqual([
      { x: 558, y: 522 },
      { x: 1458, y: 1002 }
    ]);
    expect(clickTargets).toHaveLength(1);
    expect(mappingWrites).toHaveLength(1);
    expect(mappingWrites[0]?.tabId).toBe(5);
    expect(result).toEqual({
      ok: true,
      payload: {
        clicked: true,
        tabId: 5,
        observation: buildDefaultObservation()
      }
    });
  });

  it("scrolls a blocking ancestor until the target becomes visible before clicking", async () => {
    const focusBrowserWindow = vi.fn().mockResolvedValue(undefined);
    const clickAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const scrollAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const moveMouseToScreenPoint = vi.fn().mockResolvedValue(undefined);
    const service = createAutoBrowserService({
      clickController: {
        getMapping() {
          return {
            scaleX: 1,
            scaleY: 1,
            offsetX: 100,
            offsetY: 60
          };
        },
        setMapping() {
          throw new Error("should not recalibrate when mapping is cached");
        },
        focusBrowserWindow,
        moveMouseToScreenPoint,
        clickAtScreenPoint,
        scrollAtScreenPoint
      }
    });
    let rectRequestCount = 0;
    const outboundCommands: string[] = [];

    service.attachTransport({
      send(message) {
        outboundCommands.push(message.command);

        if (handleClickObservationLifecycle(service, message, 8)) {
          return;
        }

        if (message.command !== "rect") {
          return;
        }

        rectRequestCount += 1;

        if (rectRequestCount === 1) {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              found: true,
              viewport: {
                innerWidth: 1280,
                innerHeight: 720,
                scrollX: 0,
                scrollY: 0
              },
              rect: {
                x: 50,
                y: 260,
                top: 260,
                left: 50,
                right: 170,
                bottom: 340,
                width: 120,
                height: 80,
                scrollWidth: 120,
                scrollHeight: 80
              },
              scrollableAncestors: [
                {
                  tag: "div",
                  id: "scroll-pane",
                  rect: {
                    x: 10,
                    y: 20,
                    top: 20,
                    left: 10,
                    right: 310,
                    bottom: 220,
                    width: 300,
                    height: 200
                  },
                  scrollLeft: 0,
                  scrollTop: 0,
                  scrollWidth: 300,
                  scrollHeight: 1000,
                  clientWidth: 300,
                  clientHeight: 200
                }
              ]
            }
          });
          return;
        }

        service.handleIncomingMessage({
          kind: "result",
          requestId: message.requestId,
          ok: true,
          payload: {
            found: true,
            viewport: {
              innerWidth: 1280,
              innerHeight: 720,
              scrollX: 0,
              scrollY: 0
            },
            rect: {
              x: 50,
              y: 120,
              top: 120,
              left: 50,
              right: 170,
              bottom: 200,
              width: 120,
              height: 80,
              scrollWidth: 120,
              scrollHeight: 80
            },
            scrollableAncestors: [
              {
                tag: "div",
                id: "scroll-pane",
                rect: {
                  x: 10,
                  y: 20,
                  top: 20,
                  left: 10,
                  right: 310,
                  bottom: 220,
                  width: 300,
                  height: 200
                },
                scrollLeft: 0,
                scrollTop: 140,
                scrollWidth: 300,
                scrollHeight: 1000,
                clientWidth: 300,
                clientHeight: 200
              }
            ]
          }
        });
      }
    });

    const result = await service.dispatchCommand("click", {
      selector: "#card",
      tabId: 8
    });

    expect(outboundCommands).toEqual(["clickObserveStart", "rect", "rect", "clickObserveFinish"]);
    expect(focusBrowserWindow).toHaveBeenCalledWith(8);
    expect(moveMouseToScreenPoint).toHaveBeenCalledWith({
      x: 260,
      y: 180
    });
    expect(scrollAtScreenPoint).toHaveBeenCalledWith({
      x: 0,
      y: -178.39999999999998
    });
    expect(clickAtScreenPoint).toHaveBeenCalledWith({
      x: 212.4,
      y: 218.4
    });
    expect(result).toEqual({
      ok: true,
      payload: {
        clicked: true,
        tabId: 8,
        observation: buildDefaultObservation()
      }
    });
  });

  it("clicks without scrolling when the click target is visible even if part of the element is clipped", async () => {
    const focusBrowserWindow = vi.fn().mockResolvedValue(undefined);
    const clickAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const scrollAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const service = createAutoBrowserService({
      clickController: {
        getMapping() {
          return {
            scaleX: 1,
            scaleY: 1,
            offsetX: 100,
            offsetY: 60
          };
        },
        setMapping() {
          throw new Error("should not recalibrate when mapping is cached");
        },
        focusBrowserWindow,
        clickAtScreenPoint,
        scrollAtScreenPoint
      }
    });
    const outboundCommands: string[] = [];

    service.attachTransport({
      send(message) {
        outboundCommands.push(message.command);

        if (handleClickObservationLifecycle(service, message, 8)) {
          return;
        }

        if (message.command !== "rect") {
          return;
        }

        service.handleIncomingMessage({
          kind: "result",
          requestId: message.requestId,
          ok: true,
          payload: {
            found: true,
            viewport: {
              innerWidth: 1280,
              innerHeight: 720,
              scrollX: 0,
              scrollY: 0
            },
            rect: {
              x: 50,
              y: 160,
              top: 160,
              left: 50,
              right: 170,
              bottom: 260,
              width: 120,
              height: 100,
              scrollWidth: 120,
              scrollHeight: 100
            },
            scrollableAncestors: [
              {
                tag: "div",
                id: "scroll-pane",
                rect: {
                  x: 10,
                  y: 20,
                  top: 20,
                  left: 10,
                  right: 310,
                  bottom: 220,
                  width: 300,
                  height: 200
                },
                scrollLeft: 0,
                scrollTop: 0,
                scrollWidth: 300,
                scrollHeight: 1000,
                clientWidth: 300,
                clientHeight: 200
              }
            ]
          }
        });
      }
    });

    const result = await service.dispatchCommand("click", {
      selector: "#card",
      tabId: 8
    });

    expect(outboundCommands).toEqual(["clickObserveStart", "rect", "clickObserveFinish"]);
    expect(scrollAtScreenPoint).not.toHaveBeenCalled();
    expect(clickAtScreenPoint).toHaveBeenCalledWith({
      x: 212.4,
      y: 268
    });
    expect(result).toEqual({
      ok: true,
      payload: {
        clicked: true,
        tabId: 8,
        observation: buildDefaultObservation()
      }
    });
  });

  it("ignores root scroller clipping when the target click point is visible in the viewport", async () => {
    const focusBrowserWindow = vi.fn().mockResolvedValue(undefined);
    const clickAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const scrollAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const service = createAutoBrowserService({
      clickController: {
        getMapping() {
          return {
            scaleX: 1,
            scaleY: 1,
            offsetX: 100,
            offsetY: 60
          };
        },
        setMapping() {
          throw new Error("should not recalibrate when mapping is cached");
        },
        focusBrowserWindow,
        clickAtScreenPoint,
        scrollAtScreenPoint
      }
    });
    const outboundCommands: string[] = [];

    service.attachTransport({
      send(message) {
        outboundCommands.push(message.command);

        if (handleClickObservationLifecycle(service, message, 8)) {
          return;
        }

        if (message.command !== "rect") {
          return;
        }

        service.handleIncomingMessage({
          kind: "result",
          requestId: message.requestId,
          ok: true,
          payload: {
            found: true,
            viewport: {
              innerWidth: 1280,
              innerHeight: 720,
              scrollX: 0,
              scrollY: 0
            },
            rect: {
              x: 50,
              y: 140,
              top: 140,
              left: 50,
              right: 170,
              bottom: 240,
              width: 120,
              height: 100,
              scrollWidth: 120,
              scrollHeight: 100
            },
            scrollableAncestors: [
              {
                tag: "html",
                isRootScroller: true,
                rect: {
                  x: 0,
                  y: 0,
                  top: 0,
                  left: 0,
                  right: 150,
                  bottom: 150,
                  width: 150,
                  height: 150
                },
                scrollLeft: 0,
                scrollTop: 0,
                scrollWidth: 2000,
                scrollHeight: 4000,
                clientWidth: 1280,
                clientHeight: 720
              }
            ]
          }
        });
      }
    });

    const result = await service.dispatchCommand("click", {
      selector: "#card",
      tabId: 8
    });

    expect(outboundCommands).toEqual(["clickObserveStart", "rect", "clickObserveFinish"]);
    expect(scrollAtScreenPoint).not.toHaveBeenCalled();
    expect(clickAtScreenPoint).toHaveBeenCalledWith({
      x: 212.4,
      y: 248
    });
    expect(result).toEqual({
      ok: true,
      payload: {
        clicked: true,
        tabId: 8,
        observation: buildDefaultObservation()
      }
    });
  });

  it("moves the mouse onto the nearest visible scrollable ancestor before scrolling for viewport clipping", async () => {
    const focusBrowserWindow = vi.fn().mockResolvedValue(undefined);
    const clickAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const scrollAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const moveMouseToScreenPoint = vi.fn().mockResolvedValue(undefined);
    const service = createAutoBrowserService({
      clickController: {
        getMapping() {
          return {
            scaleX: 1,
            scaleY: 1,
            offsetX: 100,
            offsetY: 60
          };
        },
        setMapping() {
          throw new Error("should not recalibrate when mapping is cached");
        },
        focusBrowserWindow,
        moveMouseToScreenPoint,
        clickAtScreenPoint,
        scrollAtScreenPoint
      }
    });
    let rectRequestCount = 0;

    service.attachTransport({
      send(message) {
        if (handleClickObservationLifecycle(service, message, 8)) {
          return;
        }

        if (message.command !== "rect") {
          return;
        }

        rectRequestCount += 1;

        if (rectRequestCount === 1) {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              found: true,
              viewport: {
                innerWidth: 1280,
                innerHeight: 180,
                scrollX: 0,
                scrollY: 0
              },
              rect: {
                x: 50,
                y: 200,
                top: 200,
                left: 50,
                right: 170,
                bottom: 280,
                width: 120,
                height: 80,
                scrollWidth: 120,
                scrollHeight: 80
              },
              scrollableAncestors: [
                {
                  tag: "div",
                  id: "inner-pane",
                  rect: {
                    x: 20,
                    y: 40,
                    top: 40,
                    left: 20,
                    right: 260,
                    bottom: 160,
                    width: 240,
                    height: 120
                  },
                  scrollLeft: 0,
                  scrollTop: 0,
                  scrollWidth: 240,
                  scrollHeight: 600,
                  clientWidth: 240,
                  clientHeight: 120
                },
                {
                  tag: "div",
                  id: "outer-pane",
                  rect: {
                    x: 10,
                    y: 20,
                    top: 20,
                    left: 10,
                    right: 310,
                    bottom: 170,
                    width: 300,
                    height: 150
                  },
                  scrollLeft: 0,
                  scrollTop: 0,
                  scrollWidth: 300,
                  scrollHeight: 1000,
                  clientWidth: 300,
                  clientHeight: 150
                }
              ]
            }
          });
          return;
        }

        service.handleIncomingMessage({
          kind: "result",
          requestId: message.requestId,
          ok: true,
          payload: {
            found: true,
            viewport: {
              innerWidth: 1280,
              innerHeight: 180,
              scrollX: 0,
              scrollY: 0
            },
            rect: {
              x: 50,
              y: 120,
              top: 120,
              left: 50,
              right: 170,
              bottom: 200,
              width: 120,
              height: 80,
              scrollWidth: 120,
              scrollHeight: 80
            },
            scrollableAncestors: [
              {
                tag: "div",
                id: "inner-pane",
                rect: {
                  x: 20,
                  y: 40,
                  top: 40,
                  left: 20,
                  right: 260,
                  bottom: 160,
                  width: 240,
                  height: 120
                },
                scrollLeft: 0,
                scrollTop: 80,
                scrollWidth: 240,
                scrollHeight: 600,
                clientWidth: 240,
                clientHeight: 120
              },
              {
                tag: "div",
                id: "outer-pane",
                rect: {
                  x: 10,
                  y: 20,
                  top: 20,
                  left: 10,
                  right: 310,
                  bottom: 170,
                  width: 300,
                  height: 150
                },
                scrollLeft: 0,
                scrollTop: 0,
                scrollWidth: 300,
                scrollHeight: 1000,
                clientWidth: 300,
                clientHeight: 150
              }
            ]
          }
        });
      }
    });

    const result = await service.dispatchCommand("click", {
      selector: "#card",
      tabId: 8
    });

    expect(moveMouseToScreenPoint).toHaveBeenCalledWith({
      x: 240,
      y: 160
    });
    expect(scrollAtScreenPoint).toHaveBeenCalledOnce();
    expect(clickAtScreenPoint).toHaveBeenCalledOnce();
    expect(result).toEqual({
      ok: true,
      payload: {
        clicked: true,
        tabId: 8,
        observation: buildDefaultObservation()
      }
    });
  });

  it("tries center then corner anchors until the target scrollable ancestor actually scrolls", async () => {
    const focusBrowserWindow = vi.fn().mockResolvedValue(undefined);
    const clickAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const scrollAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const moveMouseToScreenPoint = vi.fn().mockResolvedValue(undefined);
    const service = createAutoBrowserService({
      clickController: {
        getMapping() {
          return {
            scaleX: 1,
            scaleY: 1,
            offsetX: 100,
            offsetY: 60
          };
        },
        setMapping() {
          throw new Error("should not recalibrate when mapping is cached");
        },
        focusBrowserWindow,
        moveMouseToScreenPoint,
        clickAtScreenPoint,
        scrollAtScreenPoint
      }
    });
    let rectRequestCount = 0;

    service.attachTransport({
      send(message) {
        if (handleClickObservationLifecycle(service, message, 8)) {
          return;
        }

        if (message.command !== "rect") {
          return;
        }

        rectRequestCount += 1;

        const responses = [
          {
            found: true,
            viewport: {
              innerWidth: 1280,
              innerHeight: 180,
              scrollX: 0,
              scrollY: 0
            },
            rect: {
              x: 50,
              y: 200,
              top: 200,
              left: 50,
              right: 170,
              bottom: 280,
              width: 120,
              height: 80,
              scrollWidth: 120,
              scrollHeight: 80
            },
            scrollableAncestors: [
              {
                tag: "div",
                id: "inner-pane",
                rect: {
                  x: 20,
                  y: 40,
                  top: 40,
                  left: 20,
                  right: 260,
                  bottom: 160,
                  width: 240,
                  height: 120
                },
                scrollLeft: 0,
                scrollTop: 0,
                scrollWidth: 240,
                scrollHeight: 600,
                clientWidth: 240,
                clientHeight: 120
              }
            ]
          },
          {
            found: true,
            viewport: {
              innerWidth: 1280,
              innerHeight: 180,
              scrollX: 0,
              scrollY: 0
            },
            rect: {
              x: 50,
              y: 200,
              top: 200,
              left: 50,
              right: 170,
              bottom: 280,
              width: 120,
              height: 80,
              scrollWidth: 120,
              scrollHeight: 80
            },
            scrollableAncestors: [
              {
                tag: "div",
                id: "inner-pane",
                rect: {
                  x: 20,
                  y: 40,
                  top: 40,
                  left: 20,
                  right: 260,
                  bottom: 160,
                  width: 240,
                  height: 120
                },
                scrollLeft: 0,
                scrollTop: 0,
                scrollWidth: 240,
                scrollHeight: 600,
                clientWidth: 240,
                clientHeight: 120
              }
            ]
          },
          {
            found: true,
            viewport: {
              innerWidth: 1280,
              innerHeight: 180,
              scrollX: 0,
              scrollY: 0
            },
            rect: {
              x: 50,
              y: 120,
              top: 120,
              left: 50,
              right: 170,
              bottom: 200,
              width: 120,
              height: 80,
              scrollWidth: 120,
              scrollHeight: 80
            },
            scrollableAncestors: [
              {
                tag: "div",
                id: "inner-pane",
                rect: {
                  x: 20,
                  y: 40,
                  top: 40,
                  left: 20,
                  right: 260,
                  bottom: 160,
                  width: 240,
                  height: 120
                },
                scrollLeft: 0,
                scrollTop: 80,
                scrollWidth: 240,
                scrollHeight: 600,
                clientWidth: 240,
                clientHeight: 120
              }
            ]
          }
        ];

        const payload = responses[Math.min(rectRequestCount - 1, responses.length - 1)];
        service.handleIncomingMessage({
          kind: "result",
          requestId: message.requestId,
          ok: true,
          payload
        });
      }
    });

    const result = await service.dispatchCommand("click", {
      selector: "#card",
      tabId: 8
    });

    expect(moveMouseToScreenPoint.mock.calls).toEqual([
      [{ x: 240, y: 160 }],
      [{ x: 132, y: 112 }]
    ]);
    expect(scrollAtScreenPoint).toHaveBeenCalledTimes(2);
    expect(clickAtScreenPoint).toHaveBeenCalledOnce();
    expect(result).toEqual({
      ok: true,
      payload: {
        clicked: true,
        tabId: 8,
        observation: buildDefaultObservation()
      }
    });
  });

  it("clicks immediately after a probe when the target becomes visible even if scroll target verification does not detect movement", async () => {
    const focusBrowserWindow = vi.fn().mockResolvedValue(undefined);
    const clickAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const scrollAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const moveMouseToScreenPoint = vi.fn().mockResolvedValue(undefined);
    const service = createAutoBrowserService({
      clickController: {
        getMapping() {
          return {
            scaleX: 1,
            scaleY: 1,
            offsetX: 100,
            offsetY: 60
          };
        },
        setMapping() {
          throw new Error("should not recalibrate when mapping is cached");
        },
        focusBrowserWindow,
        moveMouseToScreenPoint,
        clickAtScreenPoint,
        scrollAtScreenPoint
      }
    });
    let rectRequestCount = 0;

    service.attachTransport({
      send(message) {
        if (handleClickObservationLifecycle(service, message, 8)) {
          return;
        }

        if (message.command !== "rect") {
          return;
        }

        rectRequestCount += 1;
        if (rectRequestCount === 1) {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              found: true,
              viewport: {
                innerWidth: 1280,
                innerHeight: 180,
                scrollX: 0,
                scrollY: 0
              },
              rect: {
                x: 50,
                y: 200,
                top: 200,
                left: 50,
                right: 170,
                bottom: 280,
                width: 120,
                height: 80,
                scrollWidth: 120,
                scrollHeight: 80
              },
              scrollableAncestors: [
                {
                  tag: "div",
                  id: "inner-pane",
                  rect: {
                    x: 20,
                    y: 40,
                    top: 40,
                    left: 20,
                    right: 260,
                    bottom: 160,
                    width: 240,
                    height: 120
                  },
                  scrollLeft: 0,
                  scrollTop: 0,
                  scrollWidth: 240,
                  scrollHeight: 600,
                  clientWidth: 240,
                  clientHeight: 120
                }
              ]
            }
          });
          return;
        }

        service.handleIncomingMessage({
          kind: "result",
          requestId: message.requestId,
          ok: true,
          payload: {
            found: true,
            viewport: {
              innerWidth: 1280,
              innerHeight: 180,
              scrollX: 0,
              scrollY: 0
            },
            rect: {
              x: 50,
              y: 120,
              top: 120,
              left: 50,
              right: 170,
              bottom: 200,
              width: 120,
              height: 80,
              scrollWidth: 120,
              scrollHeight: 80
            },
            scrollableAncestors: [
              {
                tag: "div",
                id: "inner-pane",
                rect: {
                  x: 20,
                  y: 40,
                  top: 40,
                  left: 20,
                  right: 260,
                  bottom: 160,
                  width: 240,
                  height: 120
                },
                scrollLeft: 0,
                scrollTop: 0,
                scrollWidth: 240,
                scrollHeight: 600,
                clientWidth: 240,
                clientHeight: 120
              }
            ]
          }
        });
      }
    });

    const result = await service.dispatchCommand("click", {
      selector: "#card",
      tabId: 8
    });

    expect(scrollAtScreenPoint).toHaveBeenCalledOnce();
    expect(clickAtScreenPoint).toHaveBeenCalledWith({
      x: 212.4,
      y: 218.4
    });
    expect(result).toEqual({
      ok: true,
      payload: {
        clicked: true,
        tabId: 8,
        observation: buildDefaultObservation()
      }
    });
  });

  it("fails without clicking when repeated rect snapshots do not change after scrolling", async () => {
    const focusBrowserWindow = vi.fn().mockResolvedValue(undefined);
    const clickAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const scrollAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const service = createAutoBrowserService({
      clickController: {
        getMapping() {
          return {
            scaleX: 1,
            scaleY: 1,
            offsetX: 0,
            offsetY: 0
          };
        },
        setMapping() {
          throw new Error("should not recalibrate when mapping is cached");
        },
        focusBrowserWindow,
        clickAtScreenPoint,
        scrollAtScreenPoint
      }
    });
    const outboundCommands: string[] = [];
    const blockedPayload = {
      found: true,
      viewport: {
        innerWidth: 1280,
        innerHeight: 720,
        scrollX: 0,
        scrollY: 0
      },
      rect: {
        x: 50,
        y: 260,
        top: 260,
        left: 50,
        right: 170,
        bottom: 340,
        width: 120,
        height: 80,
        scrollWidth: 120,
        scrollHeight: 80
      },
      scrollableAncestors: [
        {
          tag: "div",
          id: "scroll-pane",
          rect: {
            x: 10,
            y: 20,
            top: 20,
            left: 10,
            right: 310,
            bottom: 220,
            width: 300,
            height: 200
          },
          scrollLeft: 0,
          scrollTop: 0,
          scrollWidth: 300,
          scrollHeight: 1000,
          clientWidth: 300,
          clientHeight: 200
        }
      ]
    };

    service.attachTransport({
      send(message) {
        outboundCommands.push(message.command);

        if (handleClickObservationLifecycle(service, message, 8)) {
          return;
        }

        if (message.command === "rect") {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: blockedPayload
          });
        }
      }
    });

    const result = await service.dispatchCommand("click", {
      selector: "#card",
      tabId: 8
    });

    expect(outboundCommands).toEqual([
      "clickObserveStart",
      "rect",
      "rect",
      "rect",
      "rect",
      "rect",
      "rect"
    ]);
    expect(scrollAtScreenPoint).toHaveBeenCalledTimes(5);
    expect(clickAtScreenPoint).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      error: "element cannot be brought into view: #card"
    });
  });

  it("clicks the target and types into it for input commands", async () => {
    const focusBrowserWindow = vi.fn().mockResolvedValue(undefined);
    const clickAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const typeText = vi.fn().mockResolvedValue({
      strategy: "keystroke",
      inputSource: {
        kind: "keyboardLayout",
        id: "com.apple.keylayout.ABC",
        localizedName: "ABC"
      }
    });
    const service = createAutoBrowserService({
      clickController: {
        getMapping() {
          return {
            scaleX: 1,
            scaleY: 1,
            offsetX: 10,
            offsetY: 20
          };
        },
        setMapping() {
          throw new Error("should not recalibrate when mapping is cached");
        },
        focusBrowserWindow,
        clickAtScreenPoint
      },
      keyboardController: {
        typeText
      }
    });
    const outboundCommands: string[] = [];

    service.attachTransport({
      send(message) {
        outboundCommands.push(message.command);

        if (message.command === "rect") {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              found: true,
              viewport: {
                innerWidth: 1280,
                innerHeight: 720,
                scrollX: 0,
                scrollY: 0
              },
              rect: {
                x: 20,
                y: 40,
                top: 40,
                left: 20,
                right: 120,
                bottom: 100,
                width: 100,
                height: 60,
                scrollWidth: 180,
                scrollHeight: 260
              },
              scrollableAncestors: []
            }
          });
        }
      }
    });

    const result = await service.dispatchCommand("input", {
      selector: "#search",
      value: "hello",
      tabId: 8
    });

    expect(outboundCommands).toEqual(["rect"]);
    expect(focusBrowserWindow).toHaveBeenCalledWith(8);
    expect(clickAtScreenPoint).toHaveBeenCalledOnce();
    expect(typeText).toHaveBeenCalledWith("hello");
    expect(result).toEqual({
      ok: true,
      payload: {
        typed: true,
        tabId: 8,
        strategy: "keystroke",
        inputSource: {
          kind: "keyboardLayout",
          id: "com.apple.keylayout.ABC",
          localizedName: "ABC"
        }
      }
    });
  });

  it("uses the keyboard controller paste strategy for non-ascii input commands", async () => {
    const focusBrowserWindow = vi.fn().mockResolvedValue(undefined);
    const clickAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const typeText = vi.fn().mockResolvedValue({
      strategy: "paste",
      inputSource: {
        kind: "inputMode",
        id: "com.apple.inputmethod.SCIM.ITABC",
        localizedName: "拼音"
      }
    });
    const service = createAutoBrowserService({
      clickController: {
        getMapping() {
          return {
            scaleX: 1,
            scaleY: 1,
            offsetX: 10,
            offsetY: 20
          };
        },
        setMapping() {
          throw new Error("should not recalibrate when mapping is cached");
        },
        focusBrowserWindow,
        clickAtScreenPoint
      },
      keyboardController: {
        typeText
      }
    });
    const outboundCommands: string[] = [];

    service.attachTransport({
      send(message) {
        outboundCommands.push(message.command);

        if (message.command === "rect") {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              found: true,
              viewport: {
                innerWidth: 1280,
                innerHeight: 720,
                scrollX: 0,
                scrollY: 0
              },
              rect: {
                x: 20,
                y: 40,
                top: 40,
                left: 20,
                right: 120,
                bottom: 100,
                width: 100,
                height: 60,
                scrollWidth: 180,
                scrollHeight: 260
              },
              scrollableAncestors: []
            }
          });
          return;
        }

      }
    });

    const result = await service.dispatchCommand("input", {
      selector: "#search",
      value: "中文内容",
      tabId: 8
    });

    expect(outboundCommands).toEqual(["rect"]);
    expect(typeText).toHaveBeenCalledWith("中文内容");
    expect(result).toEqual({
      ok: true,
      payload: {
        typed: true,
        tabId: 8,
        strategy: "paste",
        inputSource: {
          kind: "inputMode",
          id: "com.apple.inputmethod.SCIM.ITABC",
          localizedName: "拼音"
        }
      }
    });
  });

  it("clicks the target, waits for the dialog, and uploads the file", async () => {
    const focusBrowserWindow = vi.fn().mockResolvedValue(undefined);
    const clickAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const sleep = vi.fn().mockResolvedValue(undefined);
    const uploadFile = vi.fn().mockResolvedValue({
      uploaded: true,
      strategy: "native-dialog"
    });
    const service = createAutoBrowserService({
      clickController: {
        getMapping() {
          return {
            scaleX: 1,
            scaleY: 1,
            offsetX: 10,
            offsetY: 20
          };
        },
        setMapping() {
          throw new Error("should not recalibrate when mapping is cached");
        },
        focusBrowserWindow,
        clickAtScreenPoint
      },
      keyboardController: {
        typeText: vi.fn(),
        uploadFile
      },
      sleep
    });
    const outboundCommands: string[] = [];

    service.attachTransport({
      send(message) {
        outboundCommands.push(message.command);

        if (message.command === "rect") {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              found: true,
              viewport: {
                innerWidth: 1280,
                innerHeight: 720,
                scrollX: 0,
                scrollY: 0
              },
              rect: {
                x: 20,
                y: 40,
                top: 40,
                left: 20,
                right: 120,
                bottom: 100,
                width: 100,
                height: 60,
                scrollWidth: 180,
                scrollHeight: 260
              },
              scrollableAncestors: []
            }
          });
        }
      }
    });

    const result = await service.dispatchCommand("upload", {
      selector: "#upload",
      filepath: "/tmp/report.pdf",
      tabId: 8
    });

    expect(outboundCommands).toEqual(["rect"]);
    expect(focusBrowserWindow).toHaveBeenCalledWith(8);
    expect(clickAtScreenPoint).toHaveBeenCalledOnce();
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(uploadFile).toHaveBeenCalledWith("/tmp/report.pdf");
    expect(result).toEqual({
      ok: true,
      payload: {
        uploaded: true,
        tabId: 8,
        strategy: "native-dialog"
      }
    });
  });

  it("focuses the browser window, activates the tab and scrolls for scroll commands", async () => {
    const focusBrowserWindow = vi.fn().mockResolvedValue(undefined);
    const scrollAtScreenPoint = vi.fn().mockResolvedValue(undefined);
    const sleep = vi.fn().mockResolvedValue(undefined);
    const service = createAutoBrowserService({
      clickController: {
        getMapping() {
          return undefined;
        },
        setMapping() {},
        focusBrowserWindow,
        clickAtScreenPoint: vi.fn().mockResolvedValue(undefined),
        scrollAtScreenPoint
      },
      sleep
    });
    const outboundCommands: string[] = [];
    const lifecycle: string[] = [];

    focusBrowserWindow.mockImplementation(async () => {
      lifecycle.push("focus");
    });
    sleep.mockImplementation(async (delayMs: number) => {
      lifecycle.push(`sleep:${delayMs}`);
    });
    scrollAtScreenPoint.mockImplementation(async () => {
      lifecycle.push("scroll");
    });

    service.attachTransport({
      send(message) {
        outboundCommands.push(message.command);
        lifecycle.push(`dispatch:${message.command}`);

        if (message.command === "scroll") {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              tabId: 18
            }
          });
        }
      }
    });

    const result = await service.dispatchCommand("scroll", {
      deltaX: 100,
      deltaY: -50,
      tabId: 18
    });

    expect(outboundCommands).toEqual(["scroll"]);
    expect(focusBrowserWindow).toHaveBeenCalledWith(18);
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(scrollAtScreenPoint).toHaveBeenCalledWith({
      x: 100,
      y: -50
    });
    expect(lifecycle).toEqual([
      "focus",
      "dispatch:scroll",
      "sleep:1000",
      "scroll"
    ]);
    expect(result).toEqual({
      ok: true,
      payload: {
        scrolled: true,
        tabId: 18,
        deltaX: 100,
        deltaY: -50
      }
    });
  });
});
