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
    expect(api.deploy).not.toHaveProperty("multiRegionConfig");

    const worker = JSON.parse(read("infra/railway/worker.railway.json"));
    expect(worker.deploy.preDeployCommand).toContain("migrate/dist/migrate.js");
    expect(worker.deploy.startCommand).toContain("worker/dist/main.js");
    expect(worker.deploy).not.toHaveProperty("healthcheckPath");
    expect(worker.deploy).not.toHaveProperty("multiRegionConfig");

    const admin = JSON.parse(read("infra/railway/admin.railway.json"));
    expect(admin.build.dockerfilePath).toBe("/infra/railway/admin.Dockerfile");
    expect(admin.deploy.healthcheckPath).toBe("/");
    expect(admin.deploy).not.toHaveProperty("multiRegionConfig");
    expect(read("infra/railway/admin.Dockerfile")).toContain("ARG VITE_API_URL");
    expect(read("infra/railway/nginx.conf")).toContain("try_files $uri $uri/ /index.html");
    expect(read(".dockerignore")).toContain("!infra/railway/nginx.conf");
  });
});

describe("single-host VPS deployment", () => {
  const compose = () => read("infra/compose.vps.yaml");
  const service = (name: string) =>
    compose().match(
      new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-z-]+:\\n|\\nvolumes:|$)`)
    )?.[1] ?? "";

  it("binds API and admin to loopback for the host's reverse proxy", () => {
    expect(service("api")).toContain('- "127.0.0.1:${API_HOST_PORT:-3200}:3000"');
    expect(service("admin")).toContain('- "127.0.0.1:${ADMIN_HOST_PORT:-3201}:8080"');
    expect(service("api")).toMatch(/ports: !override/);
    expect(service("backup")).not.toContain("ports:");
    expect(compose()).not.toMatch(/"0\.0\.0\.0:/);
  });

  it("runs Caddy only when the host has no web server", () => {
    expect(service("caddy")).toMatch(/profiles:\s*\["caddy"\]/);
    expect(service("caddy")).toMatch(/- "80:80"/);
    expect(service("caddy")).toMatch(/- "443:443"/);
    expect(compose()).toContain("image: caddy:2.10.2-alpine");
    expect(compose()).not.toContain("ACME_EMAIL");
  });

  it("proxies an Enhance/Apache site to a loopback port over TLS only", () => {
    const include = read("infra/vps/apache-include.conf.template");
    expect(include).toContain("RewriteRule ^/\\.well-known/acme-challenge/ - [L]");
    expect(include).toContain("RewriteCond %{HTTPS} !=on");
    expect(include).toContain("https://__DOMAIN__%{REQUEST_URI} [R=308,L,NE]");
    expect(include).toContain('RequestHeader set X-Forwarded-Proto "https"');
    expect(include).toContain("RewriteRule ^/(.*)$ http://127.0.0.1:__PORT__/$1 [P,L,NE]");
    expect(include).toContain("ProxyPassReverse / http://127.0.0.1:__PORT__/");
  });

  it("serves API and admin on their own HTTPS domains", () => {
    const caddyfile = read("infra/vps/Caddyfile");
    expect(caddyfile).toContain("{$API_DOMAIN}");
    expect(caddyfile).toContain("reverse_proxy api:3000");
    expect(caddyfile).toContain("{$ADMIN_DOMAIN}");
    expect(caddyfile).toContain("reverse_proxy admin:8080");
    expect(service("admin")).toContain("VITE_API_URL: https://${API_DOMAIN");
    expect(service("api")).toContain("TRUST_PROXY_HOPS: 1");
    expect(service("api")).toContain("CORS_ALLOWED_ORIGINS: https://${ADMIN_DOMAIN");
  });

  it("backs up PostgreSQL daily to the host with a 7-day rotation", () => {
    const backup = read("infra/vps/backup.sh");
    expect(service("backup")).toContain("image: postgres:17-alpine");
    expect(service("backup")).toMatch(/\$\{BACKUP_DIR:-\/var\/backups\/sale-advisor\}:\/backups/);
    expect(backup).toContain("pg_dump");
    expect(backup).toMatch(/-mtime \+7/);
    expect(backup).toContain("86400");
  });

  it("documents the VPS environment without real secrets", () => {
    const example = read(".env.vps.example");
    for (const name of [
      "API_DOMAIN",
      "ADMIN_DOMAIN",
      "API_HOST_PORT",
      "ADMIN_HOST_PORT",
      "DATABASE_POOL_MAX",
      "BACKUP_DIR",
      "POSTGRES_PASSWORD",
      "ADMIN_API_KEY"
    ])
      expect(example).toMatch(new RegExp(`^${name}=`, "m"));
    expect(example).toMatch(/^TELEGRAM_ENABLED=false$/m);
    expect(read(".gitignore")).toMatch(/^\.env\.\*$/m);
    expect(read(".gitignore")).toMatch(/^!\.env\.vps\.example$/m);
  });
});
