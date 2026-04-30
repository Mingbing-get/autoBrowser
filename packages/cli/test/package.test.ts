import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("package metadata", () => {
  it("exposes ab as a global binary", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8")
    ) as {
      name?: string;
      bin?: Record<string, string>;
      files?: string[];
    };

    expect(packageJson.name).toBe("autobrowser-cli");
    expect(packageJson.bin).toMatchObject({
      ab: "dist/bin.js"
    });
    expect(packageJson.files).toContain("dist");
    expect(packageJson.files).toContain("vendor");
  });

  it("patches the published service bundle to resolve shared from vendor/shared", () => {
    execFileSync("node", ["./scripts/prepare-npm-package.mjs"], {
      cwd: new URL("..", import.meta.url)
    });

    const publishedDispatcher = readFileSync(
      new URL("../.publish/vendor/service/dist/dispatch/command-dispatcher.js", import.meta.url),
      "utf8"
    );

    expect(publishedDispatcher).toContain('from "../../../shared/dist/index.js"');
  });
});
