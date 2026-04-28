import { describe, expect, it, vi } from "vitest";
import { createCliRunner } from "../src/index.js";

describe("cli", () => {
  it("sends an open command to the service", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        url: "https://www.baidu.com",
        summary: {
          title: "Baidu",
          url: "https://www.baidu.com"
        }
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner(["open", "https://www.baidu.com"]);

    expect(request).toHaveBeenCalledWith("open", {
      url: "https://www.baidu.com"
    });
    expect(result.exitCode).toBe(0);
  });

  it("sends a query command to the service", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        found: true,
        text: "value"
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner(["query", "#id"]);

    expect(request).toHaveBeenCalledWith("query", {
      selector: "#id"
    });
    expect(result.exitCode).toBe(0);
  });

  it("sends an optional tabId with the query command", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        found: true
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner(["query", "#id", "--tabId", "15"]);

    expect(request).toHaveBeenCalledWith("query", {
      selector: "#id",
      tabId: 15
    });
    expect(result.exitCode).toBe(0);
  });

  it("sends a summary command to the service", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        title: "Demo"
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner(["summary"]);

    expect(request).toHaveBeenCalledWith("summary", {});
    expect(result.exitCode).toBe(0);
  });

  it("sends an optional tabId with the summary command", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        title: "Demo"
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner(["summary", "--tabId=21"]);

    expect(request).toHaveBeenCalledWith("summary", {
      tabId: 21
    });
    expect(result.exitCode).toBe(0);
  });

  it("sends a text command to the service", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        text: "full page text"
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner(["text", "#s-hotsearch-wrapper"]);

    expect(request).toHaveBeenCalledWith("text", {
      selector: "#s-hotsearch-wrapper"
    });
    expect(result.exitCode).toBe(0);
  });

  it("sends an optional tabId with the text command", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        text: "full page text"
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner(["text", "#s-hotsearch-wrapper", "--tabId", "18"]);

    expect(request).toHaveBeenCalledWith("text", {
      selector: "#s-hotsearch-wrapper",
      tabId: 18
    });
    expect(result.exitCode).toBe(0);
  });

  it("sends a selector command to the service", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        found: true,
        rect: {
          x: 10,
          y: 20,
          top: 20,
          left: 10,
          right: 110,
          bottom: 60,
          width: 100,
          height: 40
        }
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner(["selector", "#card"]);

    expect(request).toHaveBeenCalledWith("selector", {
      selector: "#card"
    });
    expect(result.exitCode).toBe(0);
  });

  it("sends an optional tabId with the selector command", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        found: true
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner(["selector", "#card", "--tabId", "18"]);

    expect(request).toHaveBeenCalledWith("selector", {
      selector: "#card",
      tabId: 18
    });
    expect(result.exitCode).toBe(0);
  });

  it("sends a close command for the active tab by default", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        tabId: 12
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner(["close"]);

    expect(request).toHaveBeenCalledWith("close", {});
    expect(result.exitCode).toBe(0);
  });

  it("sends an optional tabId with the close command", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        tabId: 18
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner(["close", "--tabId", "18"]);

    expect(request).toHaveBeenCalledWith("close", {
      tabId: 18
    });
    expect(result.exitCode).toBe(0);
  });

  it("sends a tabs command to the service", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: [
        {
          tabId: 7,
          url: "https://example.com",
          title: "Example",
          active: true
        }
      ]
    });

    const runner = createCliRunner({ request });
    const result = await runner(["tabs"]);

    expect(request).toHaveBeenCalledWith("tabs", {});
    expect(result.exitCode).toBe(0);
  });

  it("starts the local service in keep-alive mode", async () => {
    const startService = vi.fn().mockResolvedValue(undefined);
    const runner = createCliRunner({
      request: vi.fn(),
      startService
    });

    const result = await runner(["serve"]);

    expect(startService).toHaveBeenCalledOnce();
    expect(result.exitCode).toBe(0);
    expect(result.keepAlive).toBe(true);
  });

  it("installs a native host manifest for a chrome extension id", async () => {
    const installHost = vi.fn().mockResolvedValue(
      "/Users/demo/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.autobrowser.host.json"
    );
    const runner = createCliRunner({
      request: vi.fn(),
      installHost
    });

    const result = await runner(["install-host", "abcdefghijklmnopabcdefghijklmnop"]);

    expect(installHost).toHaveBeenCalledWith("abcdefghijklmnopabcdefghijklmnop");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("com.autobrowser.host.json");
  });

  it("rejects an invalid chrome extension id", async () => {
    const runner = createCliRunner({
      request: vi.fn(),
      installHost: vi.fn()
    });

    await expect(runner(["install-host", "not-valid"])).rejects.toThrow(
      "Chrome extension ID must be 32 characters using letters a-p."
    );
  });

  it("prints service status", async () => {
    const requestStatus = vi.fn().mockResolvedValue({
      ok: true,
      connected: true,
      pendingRequests: 0
    });
    const runner = createCliRunner({
      request: vi.fn(),
      requestStatus
    });

    const result = await runner(["status"]);

    expect(requestStatus).toHaveBeenCalledOnce();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"connected": true');
  });
});
