import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

/**
 * Test setup for the panel.
 *
 * jsdom rather than a browser: what is worth testing here is component behaviour — what a
 * field does when a key is pressed, what a view shows while a request is in flight — and
 * none of it needs a real renderer. The paths mirror tsconfig so a test imports a module
 * the same way the application does.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.tsx", "tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
