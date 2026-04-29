import { describe, expect, it, vi } from "vitest";
import { createAutoBrowserService } from "../src/index.js";

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

  it("forwards a selector command through the same transport", async () => {
    const service = createAutoBrowserService();
    let outbound: unknown;

    service.attachTransport({
      send(message) {
        outbound = message;
      }
    });

    const pending = service.dispatchCommand("selector", {
      selector: "#card",
      tabId: 8
    });

    expect(outbound).toMatchObject({
      kind: "command",
      command: "selector",
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
        rect: {
          x: 12,
          y: 16,
          top: 16,
          left: 12,
          right: 112,
          bottom: 56,
          width: 100,
          height: 40
        }
      }
    });

    await expect(pending).resolves.toEqual({
      ok: true,
      payload: {
        found: true,
        rect: {
          x: 12,
          y: 16,
          top: 16,
          left: 12,
          right: 112,
          bottom: 56,
          width: 100,
          height: 40
        }
      }
    });
  });

  it("orchestrates a click with an existing tab mapping", async () => {
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
        clickAtScreenPoint
      }
    });
    const outboundCommands: string[] = [];

    service.attachTransport({
      send(message) {
        outboundCommands.push(message.command);

        if (message.command === "selector") {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              found: true,
              rect: {
                x: 20,
                y: 40,
                top: 40,
                left: 20,
                right: 120,
                bottom: 100,
                width: 100,
                height: 60
              }
            }
          });
        }
      }
    });

    const result = await service.dispatchCommand("click", {
      selector: "#card",
      tabId: 8
    });

    expect(outboundCommands).toEqual(["selector"]);
    expect(clickAtScreenPoint).toHaveBeenCalledOnce();
    expect(result).toEqual({
      ok: true,
      payload: {
        clicked: true,
        tabId: 8
      }
    });
  });

  it("calibrates before clicking when a tab mapping is missing", async () => {
    const calibrationTargets: Array<{ x: number; y: number }> = [];
    const clickTargets: Array<{ x: number; y: number }> = [];
    const mappingWrites: Array<{ tabId: number; mapping: unknown }> = [];
    const service = createAutoBrowserService({
      clickController: {
        getMapping() {
          return undefined;
        },
        setMapping(tabId, mapping) {
          mappingWrites.push({ tabId, mapping });
        },
        async clickAtScreenPoint(point) {
          if (calibrationTargets.length < 2) {
            calibrationTargets.push(point);
            return;
          }

          clickTargets.push(point);
        }
      }
    });
    const outboundCommands: string[] = [];

    service.attachTransport({
      send(message) {
        outboundCommands.push(message.command);

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
              }
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

        if (message.command === "selector") {
          service.handleIncomingMessage({
            kind: "result",
            requestId: message.requestId,
            ok: true,
            payload: {
              found: true,
              rect: {
                x: 200,
                y: 300,
                top: 300,
                left: 200,
                right: 320,
                bottom: 360,
                width: 120,
                height: 60
              }
            }
          });
        }
      }
    });

    const result = await service.dispatchCommand("click", {
      selector: "#card"
    });

    expect(outboundCommands).toEqual(["tabs", "clickMapStart", "clickMapFinish", "selector"]);
    expect(calibrationTargets).toHaveLength(2);
    expect(clickTargets).toHaveLength(1);
    expect(mappingWrites).toHaveLength(1);
    expect(mappingWrites[0]?.tabId).toBe(5);
    expect(result).toEqual({
      ok: true,
      payload: {
        clicked: true,
        tabId: 5
      }
    });
  });
});
