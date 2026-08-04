import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("portable production containers", () => {
  it("builds dedicated non-root api, worker and migrate targets", () => {
    const dockerfile = read("Dockerfile");
    expect(dockerfile).toContain("node:24.18.0-bookworm-slim");
    for (const target of ["api", "worker", "migrate"])
      expect(dockerfile).toMatch(new RegExp(`AS ${target}\\b`, "i"));
    expect(dockerfile.match(/USER node/g)).toHaveLength(3);
    expect(dockerfile).toMatch(/\bdeploy --prod\b/);
  });

  it("keeps databases private and migrations explicit in production compose", () => {
    const compose = read("infra/compose.production.yaml");
    expect(compose).toContain("service_completed_successfully");
    expect(compose).not.toMatch(/postgres:\s*[\s\S]*?ports:/);
    expect(compose).not.toMatch(/redis:\s*[\s\S]*?ports:/);
    expect(compose).not.toContain("db:seed");
    expect(compose).toContain("TELEGRAM_ENABLED");
  });

  it("exposes production build, smoke and verification scripts", () => {
    const manifest = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(manifest.scripts["container:build"]).toBeTruthy();
    expect(manifest.scripts["container:smoke"]).toBeTruthy();
    expect(manifest.scripts["verify:production"]).toContain("container:smoke");
    expect(read("pnpm-workspace.yaml")).toContain("injectWorkspacePackages: true");
  });

  it("smokes a complete offer and always removes ephemeral resources", () => {
    const smoke = read("scripts/container-smoke.mjs");
    expect(smoke).toMatch(/url:\s*`https:\/\/www\.kabum\.com\.br\/produto\//);
    expect(smoke).toContain('compose(["down", "--volumes", "--remove-orphans"]');
  });
});
