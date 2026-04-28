import { describe, expect, it, vi } from "vitest";
import { createCliRunner } from "../src/index.js";

describe("cli", () => {
  it("sends an open command to the service", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        url: "https://www.baidu.com"
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
