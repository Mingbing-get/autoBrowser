import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cliDir = path.resolve(scriptDir, "..");
const repoDir = path.resolve(cliDir, "..", "..");
const publishDir = path.join(cliDir, ".publish");
const vendorDir = path.join(publishDir, "vendor");
const cliPackageJsonPath = path.join(cliDir, "package.json");

await rm(publishDir, { recursive: true, force: true });

await cp(path.join(cliDir, "dist"), path.join(publishDir, "dist"), { recursive: true });

await copyPackageDist("service");
await copyPackageDist("shared");
await copyPackageDist("native-host");
await patchServiceSharedImport();
await copyReadme();
await writePublishPackageJson();

async function copyPackageDist(packageName) {
  const sourceDir = path.resolve(cliDir, "..", packageName, "dist");
  const targetDir = path.join(vendorDir, packageName, "dist");

  await mkdir(path.dirname(targetDir), { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true });
}

async function patchServiceSharedImport() {
  const filePath = path.join(vendorDir, "service", "dist", "dispatch", "command-dispatcher.js");
  const source = await readFile(filePath, "utf8");
  const patched = source.replace(
    'from "@autobrowser/shared"',
    'from "../../shared/dist/index.js"'
  );

  await writeFile(filePath, patched, "utf8");
}

async function copyReadme() {
  await cp(path.join(repoDir, "README.md"), path.join(publishDir, "README.md"));
}

async function writePublishPackageJson() {
  const cliPackageJson = JSON.parse(await readFile(cliPackageJsonPath, "utf8"));
  const servicePackageJson = JSON.parse(
    await readFile(path.resolve(cliDir, "..", "service", "package.json"), "utf8")
  );
  const nativeHostPackageJson = JSON.parse(
    await readFile(path.resolve(cliDir, "..", "native-host", "package.json"), "utf8")
  );

  const publishPackageJson = {
    name: cliPackageJson.name,
    version: cliPackageJson.version,
    type: cliPackageJson.type,
    main: cliPackageJson.main,
    types: cliPackageJson.types,
    bin: cliPackageJson.bin,
    files: ["dist", "vendor", "README.md"],
    publishConfig: cliPackageJson.publishConfig,
    dependencies: {
      "copy-paste": servicePackageJson.dependencies["copy-paste"],
      robotjs: nativeHostPackageJson.dependencies.robotjs
    }
  };

  await writeFile(
    path.join(publishDir, "package.json"),
    `${JSON.stringify(publishPackageJson, null, 2)}\n`,
    "utf8"
  );
}
