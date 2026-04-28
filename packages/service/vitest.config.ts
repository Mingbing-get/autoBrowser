import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@autobrowser/shared": resolve(__dirname, "../shared/src/index.ts")
    }
  }
});
