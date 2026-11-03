import { resolve } from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "siyuan": resolve(__dirname, "tests/__mocks__/siyuan.ts"),
    },
  },
  test: {
    environment: "node",
    globals: true,
  },
})
