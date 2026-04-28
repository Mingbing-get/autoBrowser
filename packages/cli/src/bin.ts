#!/usr/bin/env node
import { createCliRunner, createHttpClient } from "./index.js";

const runner = createCliRunner(createHttpClient());
const result = await runner(process.argv.slice(2));

if (result.stdout) {
  process.stdout.write(`${result.stdout}\n`);
}

if (result.stderr) {
  process.stderr.write(`${result.stderr}\n`);
}

if (result.keepAlive) {
  const stop = () => {
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  await new Promise<void>(() => {});
}

process.exit(result.exitCode);
