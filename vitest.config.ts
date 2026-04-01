import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    slowTestThreshold: 15_000,
    exclude: ["template/**", "node_modules/**"],
  },
});
