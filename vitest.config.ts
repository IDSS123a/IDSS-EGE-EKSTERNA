import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Unit tests for framework-free domain logic and schemas (mandate §22). */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["tests/unit/**/*.test.ts"], environment: "node" },
});
