import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      // CLI migrations, seed and rollback are exercised against PostgreSQL by packages/e2e.
      exclude: [
        "src/**/*.test.ts",
        "src/index.ts",
        "src/migrate.ts",
        "src/rollback-local.ts",
        "src/seed.ts"
      ],
      thresholds: {
        lines: 80,
        branches: 75,
        functions: 80,
        statements: 80
      }
    }
  }
});
