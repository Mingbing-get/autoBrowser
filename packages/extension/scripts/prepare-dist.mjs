import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(__dirname, "..");
const distDir = path.join(packageDir, "dist");
const manifestPath = path.join(packageDir, "manifest.json");
const distManifestPath = path.join(distDir, "manifest.json");

await mkdir(distDir, { recursive: true });

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
await writeFile(distManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

for (const assetName of ["icons", "assets"]) {
  const from = path.join(packageDir, assetName);
  const to = path.join(distDir, assetName);

  try {
    await cp(from, to, { recursive: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      continue;
    }
    throw error;
  }
}

for (const assetName of ["options.html", "options.css"]) {
  const from = path.join(packageDir, assetName);
  const to = path.join(distDir, assetName);

  try {
    await cp(from, to);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      continue;
    }
    throw error;
  }
}
