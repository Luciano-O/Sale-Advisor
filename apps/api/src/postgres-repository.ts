import { createHash, randomUUID } from "node:crypto";

import { createDatabase } from "@sale-advisor/database";
import { Queue } from "bullmq";

import type { ApiRepository, ImportRequest, IntegrationHealth, PublicOffer } from "./repository.js";

interface OfferRow {
  id: string;
  productId: string;
  vendor: string;
  model: string;
  vramGb: number | null;
  storeName: string;
  domain: string;
  reliability: number;
  priceInCents: number;
  lowestPriceInCents: number;
  coupon: string | null;
  condition: string;
  url: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  mentionCount: number;
  label: string | null;
  qualityScore: number | null;
  confidence: string | null;
  reasons: string[] | null;
}

export class PostgresApiRepository implements ApiRepository {
  readonly kind = "postgresql";
  private readonly connection = createDatabase();
  private readonly telemetryQueues = [
    "telegram-ingest",
    "resolve-url",
    "parse",
    "consolidate",
    "score",
    "notify"
  ].map((name) => new Queue(name, { connection: redisConnection() }));

  async importMessages(request: ImportRequest) {
    return this.connection.client.begin(async (sql) => {
      const existingSources = await sql<{ id: string }[]>`
        select id from sources where name = ${request.source.name} and kind = ${request.source.kind}::source_kind limit 1
      `;
      const sourceId =
        existingSources[0]?.id ??
        (
          await sql<{ id: string }[]>`
        insert into sources (name, kind) values (${request.source.name}, ${request.source.kind}::source_kind) returning id
      `
        )[0]?.id;
      if (!sourceId) throw new Error("Could not create source");

      const batches = await sql<{ id: string }[]>`
        insert into import_batches (source_id, status, notify_eligible, total_count)
        values (${sourceId}, 'processing', ${request.notifyEligible}, ${request.messages.length}) returning id
      `;
      const batchId = batches[0]?.id;
      if (!batchId) throw new Error("Could not create import batch");
      const messageIds: string[] = [];

      for (const message of request.messages) {
        const idempotencyKey = createHash("sha256")
          .update(`${sourceId}:${message.externalId ?? `${message.capturedAt}:${message.text}`}`)
          .digest("hex");
        const rows = await sql<{ id: string }[]>`
          insert into raw_messages (
            source_id, import_batch_id, external_id, idempotency_key, text, original_payload,
            supplied_url, captured_at, notify_eligible
          ) values (
            ${sourceId}, ${batchId}, ${message.externalId ?? null}, ${idempotencyKey}, ${message.text},
            ${sql.json(message)}, ${message.url ?? null}, ${message.capturedAt}, ${request.notifyEligible}
          ) on conflict (idempotency_key) do update set updated_at = now() returning id
        `;
        const messageId = rows[0]?.id;
        if (!messageId) throw new Error("Could not persist raw message");
        messageIds.push(messageId);
        await sql`
          insert into outbox_events (topic, aggregate_id, version, correlation_id, payload)
          values ('raw-message.created', ${messageId}, 1, ${randomUUID()}, ${sql.json({ rawMessageId: messageId })})
          on conflict (topic, aggregate_id, version) do nothing
        `;
      }
      await sql`
        update import_batches set status = 'completed', accepted_count = ${messageIds.length}, completed_at = now()
        where id = ${batchId}
      `;
      return { batchId, messageIds };
    });
  }

  async listOffers(input: {
    limit: number;
    cursor?: string | undefined;
    minimumLabel?: string | undefined;
  }) {
    const cursor = input.cursor ? decodeCursor(input.cursor) : null;
    const rows = await this.connection.client<OfferRow[]>`
      select o.id, p.id as "productId", p.vendor, p.model, p.vram_gb as "vramGb",
        s.name as "storeName", s.domain, s.reliability,
        o.current_price_in_cents as "priceInCents", o.lowest_price_in_cents as "lowestPriceInCents",
        o.coupon, o.condition, o.normalized_url as url, o.first_seen_at as "firstSeenAt",
        o.last_seen_at as "lastSeenAt", o.mention_count as "mentionCount",
        coalesce(score.label, 'normal') as label, coalesce(score.quality_score, 0) as "qualityScore",
        coalesce(score.confidence, 'low') as confidence, coalesce(score.reasons, '[]'::jsonb) as reasons
      from offers o
      join products p on p.id = o.product_id
      join stores s on s.id = o.store_id
      left join lateral (
        select label, quality_score, confidence, reasons from offer_scores
        where offer_id = o.id order by created_at desc limit 1
      ) score on true
      where o.status = 'active' and s.blocked_at is null
        and (${cursor?.firstSeenAt ?? null}::timestamptz is null or (o.first_seen_at, o.id) < (${cursor?.firstSeenAt ?? null}::timestamptz, ${cursor?.id ?? null}::uuid))
        and (${input.minimumLabel ?? null}::text is null or
          array_position(array['normal','boa','muito_boa','excepcional'], coalesce(score.label, 'normal')) >=
          array_position(array['normal','boa','muito_boa','excepcional'], ${input.minimumLabel ?? "normal"}))
      order by array_position(array['normal','boa','muito_boa','excepcional'], coalesce(score.label, 'normal')) desc,
        coalesce(score.quality_score, 0) desc, o.first_seen_at desc, o.id desc
      limit ${input.limit + 1}
    `;
    const hasNext = rows.length > input.limit;
    const items = rows.slice(0, input.limit).map(mapOffer);
    const last = items.at(-1);
    return { items, nextCursor: hasNext && last ? encodeCursor(last.firstSeenAt, last.id) : null };
  }

  async findOffer(id: string) {
    const rows = await this.connection.client<OfferRow[]>`
      select o.id, p.id as "productId", p.vendor, p.model, p.vram_gb as "vramGb",
        s.name as "storeName", s.domain, s.reliability,
        o.current_price_in_cents as "priceInCents", o.lowest_price_in_cents as "lowestPriceInCents",
        o.coupon, o.condition, o.normalized_url as url, o.first_seen_at as "firstSeenAt",
        o.last_seen_at as "lastSeenAt", o.mention_count as "mentionCount",
        coalesce(score.label, 'normal') as label, coalesce(score.quality_score, 0) as "qualityScore",
        coalesce(score.confidence, 'low') as confidence, coalesce(score.reasons, '[]'::jsonb) as reasons
      from offers o join products p on p.id = o.product_id join stores s on s.id = o.store_id
      left join lateral (select label, quality_score, confidence, reasons from offer_scores where offer_id = o.id order by created_at desc limit 1) score on true
      where o.id = ${id} and o.status = 'active' and s.blocked_at is null limit 1
    `;
    return rows[0] ? mapOffer(rows[0]) : null;
  }

  async upsertInstallation(input: { id: string; platform: string; appVersion: string }) {
    await this.connection.client`
      insert into device_installations (id, platform, app_version) values (${input.id}, ${input.platform}, ${input.appVersion})
      on conflict (id) do update set platform = excluded.platform, app_version = excluded.app_version, updated_at = now()
    `;
  }

  async updatePushTarget(id: string, input: { target: string | null; enabled: boolean }) {
    const rows = await this.connection.client<{ id: string }[]>`
      update device_installations set push_target = ${input.target}, push_enabled = ${input.enabled}, updated_at = now()
      where id = ${id} returning id
    `;
    return rows.length > 0;
  }

  async updatePreferences(id: string, input: { category: string; minimumLabel: string }) {
    const exists = await this.connection.client<
      { id: string }[]
    >`select id from device_installations where id = ${id}`;
    if (exists.length === 0) return false;
    await this.connection.client`
      insert into notification_subscriptions (installation_id, category, minimum_label)
      values (${id}, ${input.category}, ${input.minimumLabel})
      on conflict (installation_id) do update set category = excluded.category, minimum_label = excluded.minimum_label, updated_at = now()
    `;
    return true;
  }

  async addEvents(
    events: Array<{
      id: string;
      installationId: string;
      name: string;
      occurredAt: string;
      payload?: Record<string, string | number | boolean | null> | undefined;
    }>
  ) {
    let accepted = 0;
    for (const event of events) {
      const rows = await this.connection.client<{ id: string }[]>`
        insert into anonymous_events (id, installation_id, name, occurred_at, payload)
        values (${event.id}, ${event.installationId}, ${event.name}, ${event.occurredAt}, ${this.connection.client.json(event.payload ?? {})})
        on conflict (id) do nothing returning id
      `;
      accepted += rows.length;
    }
    return accepted;
  }

  async health() {
    const [rows] = await Promise.all([
      this.connection.client<
        { count: number }[]
      >`select count(*)::int as count from outbox_events where published_at is null`,
      this.telemetryQueues[0]?.getJobCounts("waiting")
    ]);
    return {
      checks: { database: "up" as const, redis: "up" as const },
      outboxPending: rows[0]?.count ?? 0
    };
  }

  async adminDashboard() {
    const [messages, labels, outbox] = await Promise.all([
      this.connection.client<{ status: string; count: number }[]>`
        select status::text, count(*)::int as count from raw_messages group by status
      `,
      this.connection.client<{ label: string; count: number }[]>`
        select coalesce(score.label, 'normal') as label, count(*)::int as count from offers o
        left join lateral (select label from offer_scores where offer_id = o.id order by created_at desc limit 1) score on true
        where o.status = 'active' group by coalesce(score.label, 'normal')
      `,
      this.health()
    ]);
    const counts = Object.fromEntries(messages.map((item) => [item.status, item.count]));
    return {
      pending: counts.pending ?? 0,
      partial: counts.partial ?? 0,
      failed: counts.failed ?? 0,
      outboxPending: outbox.outboxPending,
      offersByLabel: Object.fromEntries(labels.map((item) => [item.label, item.count]))
    };
  }

  async adminIntegrations(): Promise<{ integrations: IntegrationHealth[] }> {
    const enabled = process.env.TELEGRAM_ENABLED?.trim().toLowerCase() === "true";
    const configuredSourceCount = enabled
      ? new Set(
          (process.env.TELEGRAM_CHATS ?? "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        ).size
      : 0;
    const [sourceRows, instanceRows, queueCounts] = await Promise.all([
      this.connection.client<{ count: number }[]>`
        select count(*)::int as count from sources where kind = 'telegram'
      `,
      this.connection.client<
        Array<{
          instanceId: string;
          role: "active" | "standby";
          state: IntegrationHealth["status"] | "starting" | "stopped";
          heartbeatAt: Date | null;
          lastMessageAt: Date | null;
          retryCount: number;
          nextRetryAt: Date | null;
          lastError: Record<string, unknown> | null;
        }>
      >`
        select instance_id as "instanceId", role::text, state::text,
          heartbeat_at as "heartbeatAt", last_message_at as "lastMessageAt",
          retry_count as "retryCount", next_retry_at as "nextRetryAt", last_error as "lastError"
        from collector_instances where integration_kind = 'telegram'
        order by (role = 'active') desc, heartbeat_at desc nulls last
      `,
      Promise.all(
        this.telemetryQueues.map((queue) => queue.getJobCounts("waiting", "active", "failed"))
      )
    ]);
    const available = instanceRows.filter(
      (row) => row.heartbeatAt && Date.now() - row.heartbeatAt.getTime() <= 45_000
    );
    const activeRows = available.filter((row) => row.role === "active");
    const latest = activeRows[0] ?? instanceRows[0];
    const queues = queueCounts.reduce<IntegrationHealth["queues"]>(
      (total, counts) => ({
        waiting: total.waiting + (counts.waiting ?? 0),
        active: total.active + (counts.active ?? 0),
        failed: total.failed + (counts.failed ?? 0)
      }),
      { waiting: 0, active: 0, failed: 0 }
    );
    const status: IntegrationHealth["status"] = !enabled
      ? "disabled"
      : latest?.state === "blocked"
        ? "blocked"
        : activeRows.length > 0 && latest?.state === "healthy"
          ? "healthy"
          : latest?.state === "retrying"
            ? "retrying"
            : "unavailable";
    return {
      integrations: [
        {
          kind: "telegram",
          enabled,
          status,
          heartbeatAt: latest?.heartbeatAt?.toISOString() ?? null,
          lastMessageAt: latest?.lastMessageAt?.toISOString() ?? null,
          activeInstanceId: activeRows[0]?.instanceId ?? null,
          configuredSourceCount,
          persistedSourceCount: sourceRows[0]?.count ?? 0,
          instances: {
            active: activeRows.length,
            standby: available.filter((row) => row.role === "standby").length
          },
          queues,
          retryCount: latest?.retryCount ?? 0,
          nextRetryAt: latest?.nextRetryAt?.toISOString() ?? null,
          lastError: latest?.lastError ?? null
        }
      ]
    };
  }

  async adminList(resource: "messages" | "offers" | "products" | "sources" | "audit") {
    if (resource === "messages") {
      return this.connection.client<Record<string, unknown>[]>`
        select rm.id, rm.text, rm.status, rm.captured_at as "capturedAt", rm.notify_eligible as "notifyEligible",
          rp.id as "parseId", rp.version as "parseVersion", rp.status as "parseStatus", rp.candidate, rp.errors
        from raw_messages rm left join lateral (
          select * from raw_message_parses where raw_message_id = rm.id order by version desc limit 1
        ) rp on true order by rm.captured_at desc limit 200
      `;
    }
    if (resource === "offers") {
      return this.connection.client<Record<string, unknown>[]>`
        select o.*, p.canonical_key as "productKey", s.domain,
          score.label, score.quality_score as "qualityScore", score.confidence, score.metrics, score.reasons
        from offers o join products p on p.id = o.product_id join stores s on s.id = o.store_id
        left join lateral (select * from offer_scores where offer_id = o.id order by created_at desc limit 1) score on true
        order by o.first_seen_at desc limit 200
      `;
    }
    if (resource === "products") {
      return this.connection.client<Record<string, unknown>[]>`
        select p.*, coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'alias', a.normalized_alias, 'active', a.active))
          filter (where a.id is not null), '[]'::jsonb) as aliases
        from products p left join product_aliases a on a.product_id = p.id group by p.id order by p.vendor, p.model, p.vram_gb
      `;
    }
    if (resource === "sources") {
      return this.connection.client<Record<string, unknown>[]>`
        select 'source' as type, id, name, kind::text as detail, reliability, blocked_at as "blockedAt" from sources
        union all
        select 'store' as type, id, name, domain as detail, reliability, blocked_at as "blockedAt" from stores
        order by type, name
      `;
    }
    return this.connection.client<Record<string, unknown>[]>`
      select id, action, entity_type as "entityType", entity_id as "entityId", justification,
        before, after, created_at as "createdAt" from admin_audit_events order by created_at desc limit 500
    `;
  }

  async adminAction(action: string, payload: Record<string, unknown>) {
    return this.connection.client.begin(async (sql) => {
      const id = typeof payload.id === "string" ? payload.id : null;
      const justification = typeof payload.justification === "string" ? payload.justification : "";
      let entityId = id;
      let entityType = action.split(".")[0] ?? "unknown";
      let found = true;
      if (action === "message.reprocess" && id) {
        const rows = await sql<
          { id: string }[]
        >`update raw_messages set status = 'pending', updated_at = now() where id = ${id} returning id`;
        found = rows.length > 0;
        if (found) {
          const versions = await sql<{ version: number }[]>`
            select coalesce(max(version), 0)::int + 1 as version from outbox_events where topic = 'raw-message.created' and aggregate_id = ${id}
          `;
          await sql`
            insert into outbox_events (topic, aggregate_id, version, correlation_id, payload)
            values ('raw-message.created', ${id}, ${versions[0]?.version ?? 1}, ${randomUUID()}, ${sql.json({ rawMessageId: id })})
          `;
        }
      } else if (action === "message.correct" && id) {
        const changes = JSON.parse(JSON.stringify(payload.changes ?? {}));
        const rows = await sql<{ id: string }[]>`
          update raw_message_parses set admin_overrides = admin_overrides || ${sql.json(changes)}::jsonb
          where id = (select id from raw_message_parses where raw_message_id = ${id} order by version desc limit 1) returning id
        `;
        found = rows.length > 0;
      } else if ((action === "source.block" || action === "store.block") && id) {
        const blocked = payload.blocked === true;
        const rows =
          action === "source.block"
            ? await sql<
                { id: string }[]
              >`update sources set blocked_at = case when ${blocked} then now() else null end, updated_at = now() where id = ${id} returning id`
            : await sql<
                { id: string }[]
              >`update stores set blocked_at = case when ${blocked} then now() else null end, updated_at = now() where id = ${id} returning id`;
        found = rows.length > 0;
      } else if (action === "alias.create") {
        entityId = typeof payload.productId === "string" ? payload.productId : null;
        entityType = "product";
        const alias =
          typeof payload.alias === "string" ? payload.alias.trim().toLocaleLowerCase("pt-BR") : "";
        if (!entityId) found = false;
        else
          await sql`
          insert into product_aliases (product_id, normalized_alias) values (${entityId}, ${alias})
          on conflict (normalized_alias) do update set product_id = excluded.product_id, active = true, updated_at = now()
        `;
      } else if (action === "offer.merge" && id) {
        const sourceIds = Array.isArray(payload.sourceOfferIds)
          ? payload.sourceOfferIds.filter((value): value is string => typeof value === "string")
          : [];
        for (const sourceId of sourceIds) {
          await sql`update offer_mentions set offer_id = ${id} where offer_id = ${sourceId}`;
          await sql`update offers set status = 'merged', merged_into_id = ${id}, updated_at = now() where id = ${sourceId}`;
        }
        await sql`update offers set mention_count = (select count(*)::int from offer_mentions where offer_id = ${id} and active), updated_at = now() where id = ${id}`;
      } else if (action === "offer.split" && id) {
        const inserted = await sql<{ id: string }[]>`
          insert into offers (product_id, store_id, current_price_in_cents, lowest_price_in_cents, price_bucket_in_cents,
            coupon, condition, normalized_url, normalized_url_hash, store_product_id, first_seen_at, last_seen_at)
          select product_id, store_id, current_price_in_cents, lowest_price_in_cents, price_bucket_in_cents,
            coupon, condition, normalized_url, normalized_url_hash, store_product_id, first_seen_at, last_seen_at
          from offers where id = ${id} returning id
        `;
        const splitId = inserted[0]?.id;
        const mentionIds = Array.isArray(payload.mentionIds)
          ? payload.mentionIds.filter((value): value is string => typeof value === "string")
          : [];
        if (!splitId) found = false;
        else {
          for (const mentionId of mentionIds)
            await sql`update offer_mentions set offer_id = ${splitId} where id = ${mentionId} and offer_id = ${id}`;
          await sql`update offers set mention_count = (select count(*)::int from offer_mentions where offer_id = ${splitId} and active) where id = ${splitId}`;
          await sql`update offers set mention_count = (select count(*)::int from offer_mentions where offer_id = ${id} and active) where id = ${id}`;
        }
      }

      if (!found || !entityId) return { found: false };
      const audits = await sql<{ id: string }[]>`
        insert into admin_audit_events (action, entity_type, entity_id, justification, before, after)
        values (${action}, ${entityType}, ${entityId}, ${justification}, '{}'::jsonb,
          ${sql.json(JSON.parse(JSON.stringify(payload)))}) returning id
      `;
      return { found: true, auditId: audits[0]?.id };
    });
  }

  async onApplicationShutdown() {
    await Promise.all(this.telemetryQueues.map((queue) => queue.close()));
    await this.connection.close();
  }
}

function redisConnection() {
  const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(url.protocol === "rediss:" ? { tls: {} } : {})
  };
}

function mapOffer(row: OfferRow): PublicOffer {
  return {
    id: row.id,
    product: { id: row.productId, vendor: row.vendor, model: row.model, vramGb: row.vramGb },
    store: { name: row.storeName, domain: row.domain, reliability: row.reliability },
    priceInCents: row.priceInCents,
    lowestPriceInCents: row.lowestPriceInCents,
    coupon: row.coupon,
    condition: row.condition,
    url: row.url,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    mentionCount: row.mentionCount,
    score: {
      label: row.label ?? "normal",
      qualityScore: row.qualityScore ?? 0,
      confidence: row.confidence ?? "low",
      reasons: row.reasons ?? []
    }
  };
}

function encodeCursor(firstSeenAt: string, id: string) {
  return Buffer.from(JSON.stringify({ firstSeenAt, id })).toString("base64url");
}
function decodeCursor(value: string): { firstSeenAt: string; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("firstSeenAt" in parsed) ||
      !("id" in parsed) ||
      typeof parsed.firstSeenAt !== "string" ||
      typeof parsed.id !== "string"
    )
      throw new Error();
    return { firstSeenAt: parsed.firstSeenAt, id: parsed.id };
  } catch {
    throw new Error("Invalid cursor");
  }
}
