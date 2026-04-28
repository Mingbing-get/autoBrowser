export function createLauncherScript(nativeHostPath: string, logPath: string) {
  return [
    "#!/bin/sh",
    `exec "${process.execPath}" "${nativeHostPath}" 2>>"${logPath}"`
  ].join("\n");
}
