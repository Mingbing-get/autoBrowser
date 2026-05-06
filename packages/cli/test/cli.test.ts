import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createCliRunner } from "../src/index.js";

const cliPackageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
) as {
  version: string;
};

describe("cli", () => {
  it("prints help text for --help", async () => {
    const request = vi.fn();
    const runner = createCliRunner({ request });
    const result = await runner(["--help"]);

    expect(request).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage: ab <command>");
    expect(result.stdout).toContain("open <url>");
  });

  it("prints help text for -h", async () => {
    const request = vi.fn();
    const runner = createCliRunner({ request });
    const result = await runner(["-h"]);

    expect(request).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage: ab <command>");
  });

  it("prints the package version for --version", async () => {
    const request = vi.fn();
    const runner = createCliRunner({ request });
    const result = await runner(["--version"]);

    expect(request).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(cliPackageJson.version);
  });

  it("prints the package version for -v", async () => {
    const request = vi.fn();
    const runner = createCliRunner({ request });
    const result = await runner(["-v"]);

    expect(request).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(cliPackageJson.version);
  });

  it("copies the bundled extension to the target directory", async () => {
    const copyExtension = vi.fn().mockResolvedValue("/tmp/autobrowser-extension");
    const runner = createCliRunner({
      request: vi.fn(),
      copyExtension
    });
    const result = await runner(["extension", "--path", "/tmp/autobrowser-extension"]);

    expect(copyExtension).toHaveBeenCalledWith("/tmp/autobrowser-extension");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("/tmp/autobrowser-extension");
    expect(result.stdout).toContain("ab install-host <chrome-extension-id>");
  });

  it("rejects extension when the path flag is missing", async () => {
    const copyExtension = vi.fn();
    const runner = createCliRunner({
      request: vi.fn(),
      copyExtension
    });
    const result = await runner(["extension"]);

    expect(copyExtension).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Usage: extension --path <directory>");
  });

  it("supports extension with --path=<directory>", async () => {
    const copyExtension = vi.fn().mockResolvedValue("/tmp/autobrowser-extension");
    const runner = createCliRunner({
      request: vi.fn(),
      copyExtension
    });
    const result = await runner(["extension", "--path=/tmp/autobrowser-extension"]);

    expect(copyExtension).toHaveBeenCalledWith("/tmp/autobrowser-extension");
    expect(result.exitCode).toBe(0);
  });

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

  it("sends a search command to the service", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        found: true,
        matches: [
          {
            selector: "#search-button",
            text: "Search now",
            tag: "button",
            visible: true
          }
        ]
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner(["search", "Search now"]);

    expect(request).toHaveBeenCalledWith("search", {
      text: "Search now"
    });
    expect(result.exitCode).toBe(0);
  });

  it("sends an optional tabId with the search command", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        found: true,
        matches: []
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner(["search", "Search now", "--tabId", "15"]);

    expect(request).toHaveBeenCalledWith("search", {
      text: "Search now",
      tabId: 15
    });
    expect(result.exitCode).toBe(0);
  });

  it("sends a search-from-point command to the service", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        found: true,
        x: 120,
        y: 84,
        matches: []
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner(["search-from-point", "120", "84"]);

    expect(request).toHaveBeenCalledWith("searchFromPoint", {
      x: 120,
      y: 84
    });
    expect(result.exitCode).toBe(0);
  });

  it("sends an optional tabId with the search-from-point command", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        found: true,
        x: 120,
        y: 84,
        matches: []
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner(["search-from-point", "120", "84", "--tabId", "15"]);

    expect(request).toHaveBeenCalledWith("searchFromPoint", {
      x: 120,
      y: 84,
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

  it("sends a drag command with a target selector anchor", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        dragged: true,
        tabId: 5,
        targetPoint: {
          x: 420,
          y: 280
        },
        observation: {
          primaryEffect: "reorder",
          regions: [],
          meta: {
            durationMs: 300,
            endedBy: "stabilized",
            networkEvents: 0,
            meaningfulMutations: 1
          }
        }
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner([
      "drag",
      "#item",
      "--target",
      "#dropzone",
      "--direction",
      "br",
      "--tabId",
      "5"
    ]);

    expect(request).toHaveBeenCalledWith("drag", {
      selector: "#item",
      targetSelector: "#dropzone",
      direction: "br",
      tabId: 5
    });
    expect(result.exitCode).toBe(0);
  });

  it("sends a drag command with viewport coordinates", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        dragged: true,
        tabId: 5,
        targetPoint: {
          x: 123,
          y: 456
        },
        observation: {
          primaryEffect: "move",
          regions: [],
          meta: {
            durationMs: 320,
            endedBy: "stabilized",
            networkEvents: 0,
            meaningfulMutations: 2
          }
        }
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner(["drag", "#item", "--x", "123", "--y", "456"]);

    expect(request).toHaveBeenCalledWith("drag", {
      selector: "#item",
      x: 123,
      y: 456
    });
    expect(result.exitCode).toBe(0);
  });

  it("rejects drag when target and viewport coordinates are combined", async () => {
    const request = vi.fn();
    const runner = createCliRunner({ request });
    const result = await runner([
      "drag",
      "#item",
      "--target",
      "#dropzone",
      "--direction",
      "br",
      "--x",
      "123",
      "--y",
      "456"
    ]);

    expect(request).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Usage: drag");
  });

  it("rejects drag when the direction flag is invalid", async () => {
    const request = vi.fn();
    const runner = createCliRunner({ request });
    const result = await runner([
      "drag",
      "#item",
      "--target",
      "#dropzone",
      "--direction",
      "center"
    ]);

    expect(request).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("direction must be one of");
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

  it("sends a rect command to the service", async () => {
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
          height: 40,
          scrollWidth: 160,
          scrollHeight: 240
        }
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner(["rect", "#card"]);

    expect(request).toHaveBeenCalledWith("rect", {
      selector: "#card"
    });
    expect(result.exitCode).toBe(0);
  });

  it("sends an optional tabId with the rect command", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        found: true
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner(["rect", "#card", "--tabId", "18"]);

    expect(request).toHaveBeenCalledWith("rect", {
      selector: "#card",
      tabId: 18
    });
    expect(result.exitCode).toBe(0);
  });

  it("sends a click command to the service", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        clicked: true,
        tabId: 12
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner(["click", "#card"]);

    expect(request).toHaveBeenCalledWith("click", {
      selector: "#card"
    });
    expect(result.exitCode).toBe(0);
  });

  it("sends an optional tabId with the click command", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        clicked: true,
        tabId: 18
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner(["click", "#card", "--tabId", "18"]);

    expect(request).toHaveBeenCalledWith("click", {
      selector: "#card",
      tabId: 18
    });
    expect(result.exitCode).toBe(0);
  });

  it("sends a clickObserve command with observe options to the service", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        clicked: true,
        tabId: 18,
        observation: {
          primaryEffect: "overlay"
        }
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner([
      "click-observe",
      "#card",
      "--tabId",
      "18",
      "--minObserveMs",
      "120",
      "--stableWindowMs",
      "240",
      "--maxObserveMs",
      "900"
    ]);

    expect(request).toHaveBeenCalledWith("clickObserve", {
      selector: "#card",
      tabId: 18,
      observe: {
        minObserveMs: 120,
        stableWindowMs: 240,
        maxObserveMs: 900
      }
    });
    expect(result.exitCode).toBe(0);
  });

  it("rejects clickObserve when observe options are not integers", async () => {
    const request = vi.fn();
    const runner = createCliRunner({ request });
    const result = await runner(["click-observe", "#card", "--stableWindowMs", "fast"]);

    expect(request).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("stableWindowMs must be an integer");
  });

  it("sends a scroll command with x and y offsets", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        scrolled: true,
        tabId: 12,
        deltaX: 100,
        deltaY: 200
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner(["scroll", "--x", "100", "--y", "200"]);

    expect(request).toHaveBeenCalledWith("scroll", {
      deltaX: 100,
      deltaY: 200
    });
    expect(result.exitCode).toBe(0);
  });

  it("sends an optional tabId with the scroll command", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        scrolled: true,
        tabId: 18,
        deltaX: 100,
        deltaY: -50
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner(["scroll", "--x", "100", "--y", "-50", "--tabId", "18"]);

    expect(request).toHaveBeenCalledWith("scroll", {
      deltaX: 100,
      deltaY: -50,
      tabId: 18
    });
    expect(result.exitCode).toBe(0);
  });

  it("rejects scroll when both axes are missing", async () => {
    const request = vi.fn();
    const runner = createCliRunner({ request });
    const result = await runner(["scroll"]);

    expect(request).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("scroll requires");
  });

  it("sends an input command with the required value", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        typed: true,
        tabId: 12
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner(["input", "#search", "--value", "hello world"]);

    expect(request).toHaveBeenCalledWith("input", {
      selector: "#search",
      value: "hello world"
    });
    expect(result.exitCode).toBe(0);
  });

  it("sends a flow command to the service", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      results: []
    });

    const runner = createCliRunner({ request });
    const result = await runner([
      "flow",
      '[{"action":"open","url":"https://example.com"},{"action":"tabs"},{"action":"query","selector":"#search"},{"action":"search","text":"hello"},{"action":"search-from-point","x":120,"y":84},{"action":"summary"},{"action":"text","selector":"body"},{"action":"rect","selector":"#submit"},{"action":"click","selector":"#submit"},{"action":"click-observe","selector":"#submit","observe":{"maxObserveMs":1500}},{"action":"scroll","deltaX":0,"deltaY":240},{"action":"input","selector":"#search","value":"hello"},{"action":"upload","selector":"#upload","filepath":"/tmp/report.pdf"},{"action":"close","tabId":5}]'
    ]);

    expect(request).toHaveBeenCalledWith("flow", {
      steps: [
        {
          action: "open",
          url: "https://example.com"
        },
        {
          action: "tabs"
        },
        {
          action: "query",
          selector: "#search"
        },
        {
          action: "search",
          text: "hello"
        },
        {
          action: "search-from-point",
          x: 120,
          y: 84
        },
        {
          action: "summary"
        },
        {
          action: "text",
          selector: "body"
        },
        {
          action: "rect",
          selector: "#submit"
        },
        {
          action: "click",
          selector: "#submit"
        },
        {
          action: "click-observe",
          selector: "#submit",
          observe: {
            maxObserveMs: 1500
          }
        },
        {
          action: "scroll",
          deltaX: 0,
          deltaY: 240
        },
        {
          action: "input",
          selector: "#search",
          value: "hello"
        },
        {
          action: "upload",
          selector: "#upload",
          filepath: "/tmp/report.pdf"
        },
        {
          action: "close",
          tabId: 5
        }
      ]
    });
    expect(result.exitCode).toBe(0);
  });

  it("rejects flow when the JSON is invalid", async () => {
    const request = vi.fn();
    const runner = createCliRunner({ request });
    const result = await runner(["flow", "[{"]);

    expect(request).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("flow requires a valid JSON array");
  });

  it("sends an optional tabId with the input command", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        typed: true,
        tabId: 18
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner(["input", "#search", "--value", "hello", "--tabId", "18"]);

    expect(request).toHaveBeenCalledWith("input", {
      selector: "#search",
      value: "hello",
      tabId: 18
    });
    expect(result.exitCode).toBe(0);
  });

  it("rejects input when the value flag is missing", async () => {
    const request = vi.fn();
    const runner = createCliRunner({ request });
    const result = await runner(["input", "#search"]);

    expect(request).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("input requires");
  });

  it("sends an upload command with the required filepath", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        uploaded: true,
        tabId: 12,
        strategy: "native-dialog"
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner(["upload", "#upload", "/tmp/report.pdf"]);

    expect(request).toHaveBeenCalledWith("upload", {
      selector: "#upload",
      filepath: "/tmp/report.pdf"
    });
    expect(result.exitCode).toBe(0);
  });

  it("sends an optional tabId with the upload command", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      payload: {
        uploaded: true,
        tabId: 18,
        strategy: "native-dialog"
      }
    });

    const runner = createCliRunner({ request });
    const result = await runner(["upload", "#upload", "/tmp/report.pdf", "--tabId", "18"]);

    expect(request).toHaveBeenCalledWith("upload", {
      selector: "#upload",
      filepath: "/tmp/report.pdf",
      tabId: 18
    });
    expect(result.exitCode).toBe(0);
  });

  it("rejects upload when the filepath is missing", async () => {
    const request = vi.fn();
    const runner = createCliRunner({ request });
    const result = await runner(["upload", "#upload"]);

    expect(request).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Usage: upload <selector> <filepath> [--tabId <number>]");
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
