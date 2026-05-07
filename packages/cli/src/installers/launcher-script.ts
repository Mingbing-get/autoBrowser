export function createLauncherScript(
  nativeHostPath: string,
  logPath: string,
  platform: NodeJS.Platform = process.platform
) {
  if (platform === "win32") {
    return ["@echo off", `"${process.execPath}" "${nativeHostPath}" 2>>"${logPath}"`].join("\r\n");
  }

  return [
    "#!/bin/sh",
    `exec "${process.execPath}" "${nativeHostPath}" 2>>"${logPath}"`
  ].join("\n");
}
