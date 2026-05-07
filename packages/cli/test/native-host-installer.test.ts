import { describe, expect, it, vi } from "vitest";
import { createLauncherScript } from "../src/installers/launcher-script.js";
import { installNativeHostManifest } from "../src/installers/native-host-installer.js";
import { getChromeNativeHostManifestPath, getSupportDirPath } from "../src/installers/paths.js";

describe("native host installer", () => {
  it("uses Windows support and manifest paths when platform is win32", () => {
    expect(
      getSupportDirPath({
        platform: "win32",
        homedir: "C:\\Users\\demo",
        appData: "C:\\Users\\demo\\AppData\\Roaming"
      })
    ).toBe("C:\\Users\\demo\\AppData\\Roaming\\autoBrowser");

    expect(
      getChromeNativeHostManifestPath({
        platform: "win32",
        homedir: "C:\\Users\\demo",
        appData: "C:\\Users\\demo\\AppData\\Roaming"
      })
    ).toBe("C:\\Users\\demo\\AppData\\Roaming\\autoBrowser\\com.autobrowser.host.json");
  });

  it("creates a cmd launcher script on Windows", () => {
    expect(
      createLauncherScript(
        "C:\\tools\\autobrowser\\native-host\\bin.js",
        "C:\\Users\\demo\\AppData\\Roaming\\autoBrowser\\native-host.log",
        "win32"
      )
    ).toContain("@echo off");
  });

  it("registers the manifest in the Windows registry", async () => {
    const mkdir = vi.fn().mockResolvedValue(undefined);
    const chmod = vi.fn().mockResolvedValue(undefined);
    const writeFile = vi.fn().mockResolvedValue(undefined);
    const cp = vi.fn().mockResolvedValue(undefined);
    const execFile = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });

    const manifestPath = await installNativeHostManifest("abcdefghijklmnopabcdefghijklmnop", {
      platform: "win32",
      supportDir: "C:\\Users\\demo\\AppData\\Roaming\\autoBrowser",
      manifestPath: "C:\\Users\\demo\\AppData\\Roaming\\autoBrowser\\com.autobrowser.host.json",
      nativeHostPath: "C:\\Users\\明兵\\autobrowser\\vendor\\native-host\\dist\\bin.js",
      mkdir,
      chmod,
      writeFile,
      cp,
      execFile
    });

    expect(manifestPath).toBe(
      "C:\\Users\\demo\\AppData\\Roaming\\autoBrowser\\com.autobrowser.host.json"
    );
    expect(writeFile).toHaveBeenCalledWith(
      "C:\\Users\\demo\\AppData\\Roaming\\autoBrowser\\native-host.cmd",
      expect.stringContaining("%~dp0native-host\\dist\\bin.js"),
      "utf8"
    );
    expect(writeFile).toHaveBeenCalledWith(
      "C:\\Users\\demo\\AppData\\Roaming\\autoBrowser\\com.autobrowser.host.json",
      expect.stringContaining('"path": "native-host.cmd"'),
      "utf8"
    );
    expect(cp).toHaveBeenCalledWith(
      "C:\\Users\\明兵\\autobrowser\\vendor\\native-host\\dist",
      "C:\\Users\\demo\\AppData\\Roaming\\autoBrowser\\native-host\\dist",
      { recursive: true }
    );
    expect(execFile).toHaveBeenCalledWith("reg", [
      "add",
      "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.autobrowser.host",
      "/ve",
      "/t",
      "REG_SZ",
      "/d",
      "C:\\Users\\demo\\AppData\\Roaming\\autoBrowser\\com.autobrowser.host.json",
      "/f"
    ]);
  });
});
