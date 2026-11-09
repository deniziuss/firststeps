import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Server modules import "server-only" (it throws outside React Server Components); unit tests run
    // them directly in Node, so it resolves to its empty build here.
    alias: { "@": path.resolve(import.meta.dirname, "src"), "server-only": path.resolve(import.meta.dirname, "node_modules/server-only/empty.js") },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
  },
});
