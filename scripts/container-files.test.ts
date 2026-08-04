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
    expect(dockerfile.match(/USER node/g)).toHaveLength(4);
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
    expect(manifest.scripts["verify:production"]).toContain("container:build");
    expect(manifest.scripts["verify:production"]).toContain("container:smoke");
    expect(read("pnpm-workspace.yaml")).toContain("injectWorkspacePackages: true");
    expect(read("scripts/container-build.mjs")).toContain("railway-runtime");
    expect(read("scripts/container-build.mjs")).toContain("infra/railway/admin.Dockerfile");
  });

  it("smokes a complete offer and always removes ephemeral resources", () => {
    const smoke = read("scripts/container-smoke.mjs");
    expect(smoke).toMatch(/url:\s*`https:\/\/www\.kabum\.com\.br\/produto\//);
    expect(smoke).toContain('compose(["down", "--volumes", "--remove-orphans"]');
  });

  it("defines Railway runtime, API, worker and admin deployment contracts", () => {
    const dockerfile = read("Dockerfile");
    expect(dockerfile).toMatch(/AS railway-runtime\b/i);
    expect(dockerfile).toContain("/deploy/api");
    expect(dockerfile).toContain("/deploy/worker");
    expect(dockerfile).toContain("/deploy/migrate");

    const api = JSON.parse(read("infra/railway/api.railway.json"));
    expect(api.build).toMatchObject({ builder: "DOCKERFILE", dockerfilePath: "/Dockerfile" });
    expect(api.deploy.preDeployCommand).toContain("migrate/dist/migrate.js");
    expect(api.deploy.startCommand).toContain("api/dist/main.js");
    expect(api.deploy.healthcheckPath).toBe("/v1/health/ready");
    expect(api.deploy.multiRegionConfig["us-east4-eqdc4a"].numReplicas).toBe(1);

    const worker = JSON.parse(read("infra/railway/worker.railway.json"));
    expect(worker.deploy.preDeployCommand).toContain("migrate/dist/migrate.js");
    expect(worker.deploy.startCommand).toContain("worker/dist/main.js");
    expect(worker.deploy).not.toHaveProperty("healthcheckPath");
    expect(worker.deploy.multiRegionConfig["us-east4-eqdc4a"].numReplicas).toBe(1);

    const admin = JSON.parse(read("infra/railway/admin.railway.json"));
    expect(admin.build.dockerfilePath).toBe("/infra/railway/admin.Dockerfile");
    expect(admin.deploy.healthcheckPath).toBe("/");
    expect(admin.deploy.multiRegionConfig["us-east4-eqdc4a"].numReplicas).toBe(1);
    expect(read("infra/railway/admin.Dockerfile")).toContain("ARG VITE_API_URL");
    expect(read("infra/railway/nginx.conf")).toContain("try_files $uri $uri/ /index.html");
    expect(read(".dockerignore")).toContain("!infra/railway/nginx.conf");
  });
});
