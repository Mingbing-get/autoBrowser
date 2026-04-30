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
});
