import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@sale-advisor/domain": fileURLToPath(
        new URL("../../packages/domain/src/index.ts", import.meta.url)
      )
    }
  },
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/pipeline.ts",
        "src/notification.ts",
        "src/queue-config.ts",
        "src/telegram-config.ts",
        "src/telegram-message.ts",
        "src/telegram-queue.ts",
        "src/telegram-collector.ts",
        "src/process-fixtures.ts",
        "src/process-scoring-fixtures.ts"
      ],
      thresholds: { lines: 80, branches: 75, functions: 80, statements: 80 }
    }
  }
});
