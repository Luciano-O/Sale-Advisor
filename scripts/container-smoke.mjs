import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const project = "sale-advisor-production-smoke";
const composeFile = "infra/compose.production.yaml";
const port = 3210;
const adminKey = "container-smoke-admin-key-with-32-characters";
const environment = {
  ...process.env,
  COMPOSE_PROJECT_NAME: project,
  POSTGRES_DB: "sale_advisor_smoke",
  POSTGRES_USER: "sale_advisor",
  POSTGRES_PASSWORD: "container-smoke-postgres-password",
  REDIS_PASSWORD: "container-smoke-redis-password",
  DATABASE_URL:
    "postgresql://sale_advisor:container-smoke-postgres-password@postgres:5432/sale_advisor_smoke",
  REDIS_URL: "redis://:container-smoke-redis-password@redis:6379",
  ADMIN_API_KEY: adminKey,
  CORS_ALLOWED_ORIGINS: "https://admin.example.invalid",
  TRUST_PROXY_HOPS: "0",
  NOTIFICATION_PROVIDER: "fake",
  TELEGRAM_ENABLED: "false",
  API_EXTERNAL_PORT: String(port),
  IMAGE_TAG: "smoke"
};

function compose(args, options = {}) {
  const result = spawnSync("docker", ["compose", "-f", composeFile, ...args], {
    stdio: options.quiet ? "pipe" : "inherit",
    encoding: "utf8",
    env: environment
  });
  if (result.status !== 0 && !options.allowFailure) {
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`docker compose ${args.join(" ")} failed`);
  }
  return result;
}

async function eventually(operation, label, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const result = await operation();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await delay(1_000);
  }
  throw new Error(`Timed out waiting for ${label}`, { cause: lastError });
}

async function request(path, init) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, init);
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${path} returned ${response.status}`);
  return response.json();
}

try {
  compose(["up", "--detach", "--build", "--wait"], {});
  await eventually(() => request("/v1/health/live"), "container liveness");
  await eventually(() => request("/v1/health/ready"), "container readiness");
  await request("/v1/admin/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-key": adminKey },
    body: JSON.stringify({
      text: "RTX 4060 8GB por R$ 1.899 no Pix",
      capturedAt: new Date().toISOString(),
      url: `https://www.kabum.com.br/produto/${Date.now()}`
    })
  });
  const offer = await eventually(async () => {
    const feed = await request("/v1/offers?limit=10");
    return feed.items?.find((item) => item.product?.model === "RTX 4060");
  }, "containerized offer pipeline");
  process.stdout.write(`Production container smoke passed: offer=${offer.id}\n`);
} catch (error) {
  process.stderr.write("Production container smoke failed; compose logs follow.\n");
  compose(["logs", "--no-color", "--tail", "200"], { allowFailure: true });
  throw error;
} finally {
  compose(["down", "--volumes", "--remove-orphans"], { allowFailure: true, quiet: true });
}
