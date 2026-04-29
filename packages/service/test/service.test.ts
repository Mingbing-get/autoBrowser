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
          height: 40,
          scrollWidth: 140,
          scrollHeight: 220
        }
      }
    });
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

        if (message.command === "rect") {
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
                height: 60,
                scrollWidth: 180,
                scrollHeight: 260
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

    expect(outboundCommands).toEqual(["rect"]);
    expect(focusBrowserWindow).toHaveBeenCalledWith(8);
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
              }
            }
          });
        }
      }
    });

    const result = await service.dispatchCommand("click", {
      selector: "#card"
    });

    expect(outboundCommands).toEqual(["tabs", "clickMapStart", "clickMapFinish", "rect"]);
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
        tabId: 5
      }
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
              }
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
              }
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
});
