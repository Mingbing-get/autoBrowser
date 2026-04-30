import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cliDir = path.resolve(scriptDir, "..");
const publishDir = path.join(cliDir, ".publish");
const cacheDir = path.join(cliDir, ".npm-cache");
const action = process.argv[2];

if (action !== "pack" && action !== "publish") {
  throw new Error('Usage: node ./packages/cli/scripts/run-npm-release.mjs <pack|publish>');
}

await mkdir(cacheDir, { recursive: true });

const args = action === "pack" ? ["pack"] : ["publish", "--access", "public"];

await new Promise((resolve, reject) => {
  const child = spawn("npm", args, {
    cwd: publishDir,
    stdio: "inherit",
    env: {
      ...process.env,
      npm_config_cache: cacheDir
    }
  });

  child.on("exit", (code) => {
    if (code === 0) {
      resolve(undefined);
      return;
    }

    reject(new Error(`npm ${action} exited with code ${code ?? "unknown"}`));
  });

  child.on("error", reject);
});
