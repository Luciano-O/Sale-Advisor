import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";
import type { OnApplicationShutdown } from "@nestjs/common";
import { createDatabase } from "@sale-advisor/database";
import { buildOfferCandidate, scoreOffer } from "@sale-advisor/domain";
import type { ConsolidatedOffer, OfferCandidate, PriceSnapshot } from "@sale-advisor/domain";

import type { NotificationProvider } from "./notification.js";

interface RawRow {
  id: string;
  text: string;
  capturedAt: Date;
  suppliedUrl: string | null;
  notifyEligible: boolean;
}

interface PersistentOfferRow {
  id: string;
  canonical_key: string;
  vendor: "NVIDIA" | "AMD";
  model: string;
  vram_gb: number | null;
  current_price_in_cents: number;
  price_bucket_in_cents: number;
  normalized_url: string | null;
  store_product_id: string | null;
  domain: string;
  first_seen_at: Date;
  last_seen_at: Date;
  mention_count: number;
  coupon: string | null;
  reliability: number;
}

interface PersistentSnapshotRow {
  offer_id: string;
  product_id: string;
  observed_at: Date;
  amount_in_cents: number;
  domain: string;
  store_product_id: string | null;
  mention_count: number;
}

interface NotificationCandidateRow {
  notify_eligible: boolean;
  offer_id: string;
  last_seen_at: Date;
  blocked_at: Date | null;
  label: string;
}

interface NotificationTargetRow {
  id: string;
  push_target: string | null;
  minimum_label: string;
}

@Injectable()
export class PersistentPipelineService implements OnApplicationShutdown {
  private readonly connection = createDatabase();
  constructor(private readonly notifications: NotificationProvider) {}

  async parse(rawMessageId: string): Promise<boolean> {
    const existing = await this.connection.client<{ id: string; status: string }[]>`
      select id, status from raw_message_parses where raw_message_id = ${rawMessageId} and parser_version = 2 limit 1
    `;
    if (existing[0]) return existing[0].status === "completed";
    const rows = await this.connection.client<RawRow[]>`
      select id, text, captured_at as "capturedAt", supplied_url as "suppliedUrl", notify_eligible as "notifyEligible"
      from raw_messages where id = ${rawMessageId} limit 1
    `;
    const raw = rows[0];
    if (!raw) throw new Error(`Raw message ${rawMessageId} not found`);
    const candidate = buildOfferCandidate({
      rawText: raw.text,
      capturedAt: raw.capturedAt.toISOString(),
      rawMessageId: raw.id,
      ...(raw.suppliedUrl ? { url: raw.suppliedUrl } : {})
    });
    const complete = Boolean(candidate.product && candidate.price && candidate.store);
    const status = complete ? "completed" : "partial";
    await this.connection.client.begin(async (sql) => {
      const versions = await sql<{ version: number }[]>`
        select coalesce(max(version), 0)::int + 1 as version from raw_message_parses where raw_message_id = ${rawMessageId}
      `;
      await sql`
        insert into raw_message_parses (raw_message_id, version, parser_version, status, candidate, errors)
        values (${rawMessageId}, ${versions[0]?.version ?? 1}, 2, ${status}::processing_status,
          ${sql.json(JSON.parse(JSON.stringify(candidate)))}, ${sql.json(complete ? [] : ["incomplete_candidate"])})
      `;
      await sql`update raw_messages set status = ${status}::processing_status, updated_at = now() where id = ${rawMessageId}`;
    });
    return complete;
  }

  async consolidate(rawMessageId: string): Promise<string | null> {
    const rows = await this.connection.client<{ parseId: string; candidate: OfferCandidate }[]>`
      select id as "parseId", candidate from raw_message_parses
      where raw_message_id = ${rawMessageId} and status = 'completed'
      order by version desc limit 1
    `;
    const parsed = rows[0];
    const candidate = parsed?.candidate;
    if (
      !parsed ||
      !candidate?.product ||
      !candidate.price ||
      !candidate.store ||
      candidate.priceBucketInCents === null
    )
      return null;
    const product = candidate.product;
    const price = candidate.price;
    const store = candidate.store;
    const priceBucketInCents = candidate.priceBucketInCents;
    return this.connection.client.begin(async (sql) => {
      const urlHash = candidate.normalizedUrl
        ? createHash("sha256").update(candidate.normalizedUrl.normalizedUrl).digest("hex")
        : null;
      const fingerprints = [
        `${candidate.domain}:${candidate.storeProductId}:${price.amountInCents}:${candidate.coupon ?? ""}`,
        `${urlHash}:${price.amountInCents}:${candidate.coupon ?? ""}`,
        `${product.id}:${candidate.domain}:${priceBucketInCents}:${candidate.coupon ?? ""}`
      ].sort();
      for (const fingerprint of fingerprints)
        await sql`select pg_advisory_xact_lock(hashtext(${fingerprint}))`;

      const products = await sql<{ id: string }[]>`
        insert into products (canonical_key, vendor, model, vram_gb)
        values (${product.id}, ${product.vendor}, ${product.model}, ${product.vramGb ?? null})
        on conflict (canonical_key) do update set updated_at = now() returning id
      `;
      const stores = await sql<{ id: string }[]>`
        insert into stores (domain, name) values (${store.domain}, ${store.domain})
        on conflict (domain) do update set updated_at = now() returning id
      `;
      const productId = products[0]?.id;
      const storeId = stores[0]?.id;
      if (!productId || !storeId) throw new Error("Could not normalize product or store");

      let matches: Array<{ id: string }> = [];
      if (candidate.storeProductId)
        matches = await sql<{ id: string }[]>`
        select id from offers where status = 'active' and product_id = ${productId} and store_id = ${storeId}
          and store_product_id = ${candidate.storeProductId} and current_price_in_cents = ${price.amountInCents}
          and coalesce(coupon, '') = ${candidate.coupon ?? ""} and first_seen_at >= ${candidate.capturedAt}::timestamptz - interval '48 hours'
        order by first_seen_at desc limit 1
      `;
      if (!matches[0] && urlHash)
        matches = await sql<{ id: string }[]>`
        select id from offers where status = 'active' and product_id = ${productId}
          and normalized_url_hash = ${urlHash} and current_price_in_cents = ${price.amountInCents}
          and coalesce(coupon, '') = ${candidate.coupon ?? ""} and first_seen_at >= ${candidate.capturedAt}::timestamptz - interval '48 hours'
        order by first_seen_at desc limit 1
      `;
      if (!matches[0])
        matches = await sql<{ id: string }[]>`
        select id from offers where status = 'active' and product_id = ${productId} and store_id = ${storeId}
          and price_bucket_in_cents = ${priceBucketInCents} and coalesce(coupon, '') = ${candidate.coupon ?? ""}
          and first_seen_at >= ${candidate.capturedAt}::timestamptz - interval '48 hours'
        order by first_seen_at desc limit 1
      `;
      let offerId = matches[0]?.id;
      if (!offerId) {
        const inserted = await sql<{ id: string }[]>`
          insert into offers (product_id, store_id, current_price_in_cents, lowest_price_in_cents,
            price_bucket_in_cents, coupon, condition, normalized_url, normalized_url_hash,
            store_product_id, first_seen_at, last_seen_at)
          values (${productId}, ${storeId}, ${price.amountInCents}, ${price.amountInCents},
            ${priceBucketInCents}, ${candidate.coupon}, ${candidate.condition},
            ${candidate.normalizedUrl?.normalizedUrl ?? null}, ${urlHash}, ${candidate.storeProductId},
            ${candidate.capturedAt}, ${candidate.capturedAt}) returning id
        `;
        offerId = inserted[0]?.id;
      }
      if (!offerId) throw new Error("Could not consolidate offer");
      await sql`update offer_mentions set active = false where raw_message_id = ${rawMessageId} and parse_id <> ${parsed.parseId}`;
      const mentions = await sql<{ id: string }[]>`
        insert into offer_mentions (offer_id, raw_message_id, parse_id, mentioned_at)
        values (${offerId}, ${rawMessageId}, ${parsed.parseId}, ${candidate.capturedAt})
        on conflict (raw_message_id, parse_id) do nothing returning id
      `;
      await sql`
        insert into price_snapshots (offer_id, raw_message_id, amount_in_cents, payment_method, observed_at)
        values (${offerId}, ${rawMessageId}, ${price.amountInCents}, ${price.paymentMethod}, ${candidate.capturedAt})
        on conflict (offer_id, raw_message_id, amount_in_cents) do nothing
      `;
      if (mentions[0])
        await sql`
        update offers set current_price_in_cents = ${price.amountInCents},
          lowest_price_in_cents = least(lowest_price_in_cents, ${price.amountInCents}),
          price_bucket_in_cents = ${priceBucketInCents}, last_seen_at = greatest(last_seen_at, ${candidate.capturedAt}),
          mention_count = mention_count + 1, updated_at = now() where id = ${offerId}
      `;
      return offerId;
    });
  }

  async scoreAffected(rawMessageId: string): Promise<void> {
    const origins = await this.connection.client<{ productId: string; observedAt: Date }[]>`
      select o.product_id as "productId", ps.observed_at as "observedAt" from price_snapshots ps
      join offers o on o.id = ps.offer_id where ps.raw_message_id = ${rawMessageId} order by ps.observed_at desc limit 1
    `;
    const origin = origins[0];
    if (!origin) return;
    const offers = await this.connection.client<PersistentOfferRow[]>`
      select o.*, p.canonical_key, p.vendor, p.model, p.vram_gb, s.domain, s.reliability
      from offers o join products p on p.id = o.product_id join stores s on s.id = o.store_id
      where o.product_id = ${origin.productId} and o.first_seen_at between ${origin.observedAt} and ${origin.observedAt} + interval '90 days'
      order by o.first_seen_at
    `;
    const snapshots = await this.connection.client<PersistentSnapshotRow[]>`
      select ps.offer_id, o.product_id, ps.observed_at, ps.amount_in_cents, s.domain, o.store_product_id, o.mention_count
      from price_snapshots ps join offers o on o.id = ps.offer_id join stores s on s.id = o.store_id
      where o.product_id = ${origin.productId}
    `;
    const domainSnapshots: PriceSnapshot[] = snapshots.map((row) => ({
      offerId: row.offer_id,
      productId: row.product_id,
      observedAt: row.observed_at.toISOString(),
      amountInCents: row.amount_in_cents,
      domain: row.domain,
      storeProductId: row.store_product_id,
      mentionCount: row.mention_count
    }));
    for (const row of offers) {
      const offer = mapConsolidatedOffer(row);
      const scored = scoreOffer(offer, domainSnapshots);
      const inputHash = createHash("sha256")
        .update(
          JSON.stringify({
            price: offer.price.amountInCents,
            metrics: scored.metrics,
            reasons: scored.reasons
          })
        )
        .digest("hex");
      await this.connection.client`
        insert into offer_scores (offer_id, policy_version, label, quality_score, confidence, input_hash, metrics, reasons, history_cutoff_at)
        values (${offer.id}, 'offline-price-history-v1', ${scored.label}, ${scored.qualityScore}, ${scored.confidence}, ${inputHash},
          ${this.connection.client.json(JSON.parse(JSON.stringify(scored.metrics)))}, ${this.connection.client.json(scored.reasons)}, ${offer.firstSeenAt})
        on conflict (offer_id, policy_version, input_hash) do nothing
      `;
    }
  }

  async notify(rawMessageId: string): Promise<void> {
    const rows = await this.connection.client<NotificationCandidateRow[]>`
      select rm.notify_eligible, o.id as offer_id, o.last_seen_at, s.blocked_at,
        coalesce(sc.label, 'normal') as label
      from raw_messages rm join offer_mentions om on om.raw_message_id = rm.id and om.active
      join offers o on o.id = om.offer_id join stores s on s.id = o.store_id
      left join lateral (select label from offer_scores where offer_id = o.id order by created_at desc limit 1) sc on true
      where rm.id = ${rawMessageId} limit 1
    `;
    const row = rows[0];
    if (
      !row?.notify_eligible ||
      row.blocked_at ||
      Date.now() - row.last_seen_at.getTime() > 48 * 60 * 60 * 1_000
    )
      return;
    const targets = await this.connection.client<NotificationTargetRow[]>`
      select d.id, d.push_target, coalesce(n.minimum_label, 'boa') as minimum_label
      from device_installations d left join notification_subscriptions n on n.installation_id = d.id
      where d.push_enabled or ${this.notifications.name} = 'fake'
    `;
    const rank: Record<string, number> = { normal: 0, boa: 1, muito_boa: 2, excepcional: 3 };
    for (const target of targets) {
      if ((rank[row.label] ?? 0) < (rank[target.minimum_label] ?? 1)) continue;
      const delivery = await this.connection.client<{ id: string }[]>`
        insert into notification_deliveries (installation_id, offer_id, provider, status, payload)
        values (${target.id}, ${row.offer_id}, ${this.notifications.name}, 'pending', ${this.connection.client.json({ offerId: row.offer_id })})
        on conflict (installation_id, offer_id) do nothing returning id
      `;
      const deliveryId = delivery[0]?.id;
      if (!deliveryId) continue;
      try {
        await this.notifications.send(
          { installationId: target.id, token: target.push_target },
          { offerId: row.offer_id }
        );
        await this.connection
          .client`update notification_deliveries set status = 'sent' where id = ${deliveryId}`;
      } catch (error) {
        await this.connection
          .client`update notification_deliveries set status = 'failed', error = ${String(error)} where id = ${deliveryId}`;
        throw error;
      }
    }
  }

  async markFailed(rawMessageId: string, error: unknown) {
    await this.connection.client`
      update raw_messages set status = 'failed', original_payload = original_payload ||
        ${this.connection.client.json({ finalError: String(error) })}::jsonb, updated_at = now() where id = ${rawMessageId}
    `;
  }

  async onApplicationShutdown() {
    await this.connection.client.end();
  }
}

function mapConsolidatedOffer(row: PersistentOfferRow): ConsolidatedOffer {
  return {
    id: row.id,
    product: { id: row.canonical_key, vendor: row.vendor, model: row.model, vramGb: row.vram_gb },
    price: {
      amountInCents: row.current_price_in_cents,
      currency: "BRL",
      paymentMethod: "unknown",
      rawText: "persisted"
    },
    priceBucketInCents: row.price_bucket_in_cents,
    normalizedUrl: row.normalized_url,
    store: {
      domain: row.domain,
      adapterName: "persistent",
      storeProductId: row.store_product_id,
      storeProductIdSource: "none"
    },
    storeProductId: row.store_product_id,
    domain: row.domain,
    firstSeenAt: row.first_seen_at.toISOString(),
    lastSeenAt: row.last_seen_at.toISOString(),
    mentionCount: row.mention_count,
    coupon: row.coupon,
    storeReliability: row.reliability
  };
}
