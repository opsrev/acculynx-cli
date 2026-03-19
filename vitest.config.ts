import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      ACCULYNX_API_KEY: "test-key",
    },
  },
});
