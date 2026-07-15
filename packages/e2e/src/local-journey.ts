import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const apiUrl = "http://127.0.0.1:3100";
const databaseUrl = "postgresql://postgres:postgres@127.0.0.1:5432/sale_advisor";
const adminKey = "local-e2e-admin-key-with-32-characters";
const pnpmCli = process.env.npm_execpath;
const docker =
  process.platform === "win32" &&
  existsSync("C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe")
    ? "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe"
    : "docker";
const environment = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  REDIS_URL: "redis://127.0.0.1:6379",
  API_PORT: "3100",
  ADMIN_API_KEY: adminKey,
  NOTIFICATION_PROVIDER: "fake",
  NODE_ENV: "test"
};

function command(executable: string, args: string[]) {
  const result = spawnSync(executable, args, {
    cwd: repositoryRoot,
    env: environment,
    encoding: "utf8",
    stdio: "pipe",
    shell: false
  });
  if (result.status !== 0)
    throw new Error(
      [
        `Command failed: ${executable} ${args.join(" ")}`,
        result.error?.message,
        result.stdout,
        result.stderr
      ]
        .filter(Boolean)
        .join("\n")
    );
}

function pnpm(args: string[]) {
  if (!pnpmCli) throw new Error("npm_execpath is required to run the workspace package manager");
  command(process.execPath, [pnpmCli, ...args]);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers }
  });
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${path} returned ${response.status}`);
  return (await response.json()) as T;
}

async function eventually<T>(
  operation: () => Promise<T | null>,
  label: string,
  timeoutMs = 45_000
) {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const value = await operation();
      if (value !== null) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${label}`, { cause: lastError });
}

function start(entry: string): ChildProcess {
  return spawn(process.execPath, [entry], {
    cwd: repositoryRoot,
    env: environment,
    stdio: ["ignore", "inherit", "inherit"]
  });
}

function stop(process: ChildProcess | undefined) {
  if (process && !process.killed) process.kill();
}

let api: ChildProcess | undefined;
let worker: ChildProcess | undefined;
let sql: ReturnType<typeof postgres> | undefined;

try {
  command(docker, ["compose", "-f", "infra/compose.yaml", "up", "-d", "--wait"]);
  pnpm(["db:rollback:local"]);
  pnpm(["db:migrate"]);
  pnpm(["db:seed"]);
  pnpm(["db:seed"]);

  sql = postgres(databaseUrl, { max: 1 });
  const productRows = await sql<Array<{ productCount: number }>>`
    select count(*)::int as "productCount" from products
  `;
  assert.equal(productRows[0]?.productCount, 9, "taxonomy seed must be idempotent");

  const requiredIndexes = [
    "offers_feed_idx",
    "raw_messages_source_external_unique",
    "notification_delivery_once_unique",
    "outbox_aggregate_version_unique"
  ];
  const indexes = await sql<Array<{ indexname: string }>>`
    select indexname from pg_indexes
    where schemaname = 'public' and indexname = any(${requiredIndexes})
  `;
  assert.deepEqual(
    indexes.map(({ indexname }) => indexname).sort(),
    [...requiredIndexes].sort(),
    "critical constraints and query indexes must be migrated"
  );

  await sql.end({ timeout: 2 });
  sql = undefined;
  pnpm(["db:rollback:local"]);
  sql = postgres(databaseUrl, { max: 1 });
  const rollbackRows = await sql<
    Array<{ productsAfterRollback: string | null }>
  >`select to_regclass('public.products')::text as "productsAfterRollback"`;
  assert.equal(
    rollbackRows[0]?.productsAfterRollback,
    null,
    "local rollback must recreate an empty public schema"
  );
  await sql.end({ timeout: 2 });
  sql = undefined;

  pnpm(["db:migrate"]);
  pnpm(["db:seed"]);

  api = start("apps/api/dist/main.js");
  worker = start("apps/worker/dist/main.js");
  await eventually(
    async () => ((await request<{ status: string }>("/v1/health")).status === "ok" ? true : null),
    "API health"
  );

  const installationId = randomUUID();
  await request("/v1/installations", {
    method: "POST",
    body: JSON.stringify({ id: installationId, platform: "android", appVersion: "e2e" })
  });
  await request(`/v1/installations/${installationId}/notification-preferences`, {
    method: "PUT",
    body: JSON.stringify({ category: "GPU", minimumLabel: "normal" })
  });

  const externalId = `e2e-${randomUUID()}`;
  const manual = {
    externalId,
    text: "RTX 4060 8GB por R$ 1.899 no Pix na Kabum",
    capturedAt: new Date().toISOString(),
    url: `https://www.kabum.com.br/produto/${Date.now()}`
  };
  const imported = await request<{ messageId: string }>("/v1/admin/messages", {
    method: "POST",
    headers: { "x-admin-key": adminKey },
    body: JSON.stringify(manual)
  });
  const duplicate = await request<{ messageId: string }>("/v1/admin/messages", {
    method: "POST",
    headers: { "x-admin-key": adminKey },
    body: JSON.stringify(manual)
  });
  assert.equal(duplicate.messageId, imported.messageId, "manual ingestion must be idempotent");

  sql = postgres(databaseUrl, { max: 1 });

  await eventually(async () => {
    const messages = await request<{ items: Array<{ id: string; status: string }> }>(
      "/v1/admin/messages",
      { headers: { "x-admin-key": adminKey } }
    );
    return messages.items.some(
      ({ id, status }) => id === imported.messageId && status === "completed"
    )
      ? true
      : null;
  }, "worker parsing and consolidation");

  const processedOffer = await eventually(async () => {
    const rows = await sql!<Array<{ offerId: string }>>`
      select offer_id as "offerId"
      from offer_mentions
      where raw_message_id = ${imported.messageId}
      limit 1
    `;
    return rows[0] ?? null;
  }, "offer traceability");

  const offer = await eventually(async () => {
    const feed = await request<{
      items: Array<{ id: string; product: { model: string }; score: { label: string } }>;
    }>("/v1/offers?limit=50");
    return feed.items.find(({ id }) => id === processedOffer.offerId) ?? null;
  }, "public feed publication");
  assert.ok(["normal", "boa", "muito_boa", "excepcional"].includes(offer.score.label));

  const detail = await request<{ id: string; product: { model: string }; rawText?: unknown }>(
    `/v1/offers/${offer.id}`
  );
  assert.equal(detail.product.model, "RTX 4060");
  assert.equal(detail.rawText, undefined, "public details must not expose raw messages");

  const eventId = randomUUID();
  const event = {
    id: eventId,
    installationId,
    name: "offer_viewed",
    occurredAt: new Date().toISOString(),
    payload: { offerId: offer.id }
  };
  const accepted = await request<{ acceptedCount: number }>("/v1/events/batch", {
    method: "POST",
    body: JSON.stringify({ events: [event] })
  });
  const repeated = await request<{ acceptedCount: number }>("/v1/events/batch", {
    method: "POST",
    body: JSON.stringify({ events: [event] })
  });
  assert.equal(accepted.acceptedCount, 1);
  assert.equal(repeated.acceptedCount, 0, "anonymous events must be idempotent");

  const delivery = await eventually(async () => {
    const rows = await sql!<
      Array<{ status: string; provider: string; payload: { offerId: string } }>
    >`
      select status, provider, payload from notification_deliveries
      where installation_id = ${installationId} and offer_id = ${offer.id}
    `;
    return rows[0]?.status === "sent" ? rows[0] : null;
  }, "fake notification delivery");
  assert.equal(delivery.provider, "fake");
  assert.equal(delivery.payload.offerId, offer.id);

  const traces = await sql<Array<{ parses: number; mentions: number; snapshots: number }>>`
    select
      (select count(*)::int from raw_message_parses where raw_message_id = ${imported.messageId}) as parses,
      (select count(*)::int from offer_mentions where raw_message_id = ${imported.messageId}) as mentions,
      (select count(*)::int from price_snapshots where raw_message_id = ${imported.messageId}) as snapshots
  `;
  assert.deepEqual(traces[0], { parses: 1, mentions: 1, snapshots: 1 });
  console.log(`Local MVP journey passed: message=${imported.messageId} offer=${offer.id}`);
} finally {
  if (sql) await sql.end({ timeout: 2 });
  stop(worker);
  stop(api);
}
