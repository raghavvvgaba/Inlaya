import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(new URL(import.meta.url)));

export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(rootDir, "src/test/server-only.ts"),
      "~": path.resolve(rootDir, "src"),
    },
  },
  test: {
    environment: "node",
  },
});
