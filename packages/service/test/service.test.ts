import { describe, expect, it } from "vitest";
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
});
