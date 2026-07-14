import { createHash, randomUUID } from "node:crypto";

import { createDatabase } from "@sale-advisor/database";

import type { ApiRepository, ImportRequest, PublicOffer } from "./repository.js";

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
    const rows = await this.connection.client<
      { count: number }[]
    >`select count(*)::int as count from outbox_events where published_at is null`;
    return { outboxPending: rows[0]?.count ?? 0 };
  }

  async onApplicationShutdown() {
    await this.connection.client.end();
  }
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
