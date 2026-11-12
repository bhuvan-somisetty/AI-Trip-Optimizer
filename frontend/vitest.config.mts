import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Component and unit tests (docs/12_Testing_Strategy.md). jsdom stands in for the browser;
// nothing here calls the real API: tests mock fetch or the store.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    // jsdom is slow to start; a couple of workers keeps it inside the start-up timeout on small machines.
    maxWorkers: 2,
  },
});
