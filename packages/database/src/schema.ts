import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const sourceKind = pgEnum("source_kind", ["manual", "import", "telegram"]);
export const processingStatus = pgEnum("processing_status", [
  "pending",
  "processing",
  "partial",
  "completed",
  "failed"
]);
export const offerStatus = pgEnum("offer_status", ["active", "merged", "split", "expired"]);
export const deliveryStatus = pgEnum("delivery_status", ["pending", "sent", "failed", "skipped"]);

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    kind: sourceKind("kind").notNull(),
    reliability: integer("reliability").notNull().default(50),
    blockedAt: timestamp("blocked_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (table) => [check("sources_reliability_range", sql`${table.reliability} between 0 and 100`)]
);

export const importBatches = pgTable("import_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => sources.id),
  status: processingStatus("status").notNull().default("pending"),
  notifyEligible: boolean("notify_eligible").notNull().default(false),
  totalCount: integer("total_count").notNull().default(0),
  acceptedCount: integer("accepted_count").notNull().default(0),
  rejectedCount: integer("rejected_count").notNull().default(0),
  errors: jsonb("errors").notNull().default([]),
  createdAt: createdAt(),
  completedAt: timestamp("completed_at", { withTimezone: true })
});

export const rawMessages = pgTable(
  "raw_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
    importBatchId: uuid("import_batch_id").references(() => importBatches.id),
    externalId: varchar("external_id", { length: 255 }),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    text: text("text").notNull(),
    originalPayload: jsonb("original_payload").notNull().default({}),
    suppliedUrl: text("supplied_url"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    status: processingStatus("status").notNull().default("pending"),
    notifyEligible: boolean("notify_eligible").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (table) => [
    uniqueIndex("raw_messages_source_external_unique").on(table.sourceId, table.externalId),
    uniqueIndex("raw_messages_idempotency_unique").on(table.idempotencyKey),
    index("raw_messages_status_captured_idx").on(table.status, table.capturedAt)
  ]
);

export const rawMessageParses = pgTable(
  "raw_message_parses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rawMessageId: uuid("raw_message_id")
      .notNull()
      .references(() => rawMessages.id),
    version: integer("version").notNull(),
    parserVersion: integer("parser_version").notNull(),
    status: processingStatus("status").notNull(),
    candidate: jsonb("candidate").notNull().default({}),
    errors: jsonb("errors").notNull().default([]),
    adminOverrides: jsonb("admin_overrides").notNull().default({}),
    createdAt: createdAt()
  },
  (table) => [
    uniqueIndex("raw_message_parses_message_version_unique").on(table.rawMessageId, table.version)
  ]
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    canonicalKey: varchar("canonical_key", { length: 100 }).notNull().unique(),
    category: varchar("category", { length: 40 }).notNull().default("GPU"),
    vendor: varchar("vendor", { length: 40 }).notNull(),
    model: varchar("model", { length: 80 }).notNull(),
    vramGb: integer("vram_gb"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (table) => [uniqueIndex("products_variant_unique").on(table.vendor, table.model, table.vramGb)]
);

export const productAliases = pgTable(
  "product_aliases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    normalizedAlias: varchar("normalized_alias", { length: 160 }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (table) => [uniqueIndex("product_aliases_alias_unique").on(table.normalizedAlias)]
);

export const stores = pgTable(
  "stores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domain: varchar("domain", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 120 }).notNull(),
    reliability: integer("reliability").notNull().default(50),
    blockedAt: timestamp("blocked_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (table) => [check("stores_reliability_range", sql`${table.reliability} between 0 and 100`)]
);

export const offers = pgTable(
  "offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id),
    status: offerStatus("status").notNull().default("active"),
    mergedIntoId: uuid("merged_into_id"),
    currentPriceInCents: integer("current_price_in_cents").notNull(),
    lowestPriceInCents: integer("lowest_price_in_cents").notNull(),
    priceBucketInCents: integer("price_bucket_in_cents").notNull(),
    coupon: varchar("coupon", { length: 80 }),
    condition: varchar("condition", { length: 40 }).notNull().default("unknown"),
    normalizedUrl: text("normalized_url"),
    normalizedUrlHash: varchar("normalized_url_hash", { length: 64 }),
    storeProductId: varchar("store_product_id", { length: 255 }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    mentionCount: integer("mention_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (table) => [
    index("offers_feed_idx").on(table.status, table.firstSeenAt, table.id),
    index("offers_product_time_idx").on(table.productId, table.firstSeenAt),
    index("offers_store_product_idx").on(table.storeId, table.storeProductId),
    index("offers_url_hash_idx").on(table.normalizedUrlHash)
  ]
);

export const offerMentions = pgTable(
  "offer_mentions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id),
    rawMessageId: uuid("raw_message_id")
      .notNull()
      .references(() => rawMessages.id),
    parseId: uuid("parse_id")
      .notNull()
      .references(() => rawMessageParses.id),
    active: boolean("active").notNull().default(true),
    mentionedAt: timestamp("mentioned_at", { withTimezone: true }).notNull(),
    createdAt: createdAt()
  },
  (table) => [
    uniqueIndex("offer_mentions_message_parse_unique").on(table.rawMessageId, table.parseId)
  ]
);

export const priceSnapshots = pgTable(
  "price_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id),
    rawMessageId: uuid("raw_message_id")
      .notNull()
      .references(() => rawMessages.id),
    amountInCents: integer("amount_in_cents").notNull(),
    paymentMethod: varchar("payment_method", { length: 30 }).notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    createdAt: createdAt()
  },
  (table) => [
    uniqueIndex("price_snapshots_observation_unique").on(
      table.offerId,
      table.rawMessageId,
      table.amountInCents
    ),
    index("price_snapshots_offer_time_idx").on(table.offerId, table.observedAt)
  ]
);

export const offerScores = pgTable(
  "offer_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id),
    policyVersion: varchar("policy_version", { length: 80 }).notNull(),
    label: varchar("label", { length: 30 }).notNull(),
    qualityScore: integer("quality_score").notNull(),
    confidence: varchar("confidence", { length: 20 }).notNull(),
    metrics: jsonb("metrics").notNull(),
    reasons: jsonb("reasons").notNull(),
    historyCutoffAt: timestamp("history_cutoff_at", { withTimezone: true }).notNull(),
    createdAt: createdAt()
  },
  (table) => [index("offer_scores_offer_created_idx").on(table.offerId, table.createdAt)]
);

export const deviceInstallations = pgTable("device_installations", {
  id: uuid("id").primaryKey(),
  platform: varchar("platform", { length: 20 }).notNull(),
  appVersion: varchar("app_version", { length: 50 }).notNull(),
  pushTarget: text("push_target"),
  pushEnabled: boolean("push_enabled").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt()
});

export const notificationSubscriptions = pgTable("notification_subscriptions", {
  installationId: uuid("installation_id")
    .primaryKey()
    .references(() => deviceInstallations.id),
  category: varchar("category", { length: 40 }).notNull().default("GPU"),
  minimumLabel: varchar("minimum_label", { length: 30 }).notNull().default("boa"),
  updatedAt: updatedAt()
});

export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    installationId: uuid("installation_id")
      .notNull()
      .references(() => deviceInstallations.id),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id),
    provider: varchar("provider", { length: 30 }).notNull(),
    status: deliveryStatus("status").notNull().default("pending"),
    payload: jsonb("payload").notNull(),
    error: text("error"),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("notification_delivery_once_unique").on(table.installationId, table.offerId)
  ]
);

export const anonymousEvents = pgTable(
  "anonymous_events",
  {
    id: uuid("id").primaryKey(),
    installationId: uuid("installation_id")
      .notNull()
      .references(() => deviceInstallations.id),
    name: varchar("name", { length: 50 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    payload: jsonb("payload").notNull().default({}),
    createdAt: createdAt()
  },
  (table) => [
    index("anonymous_events_installation_time_idx").on(table.installationId, table.occurredAt)
  ]
);

export const adminAuditEvents = pgTable(
  "admin_audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    action: varchar("action", { length: 80 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: uuid("entity_id"),
    justification: text("justification").notNull(),
    before: jsonb("before").notNull().default({}),
    after: jsonb("after").notNull().default({}),
    createdAt: createdAt()
  },
  (table) => [index("admin_audit_entity_idx").on(table.entityType, table.entityId, table.createdAt)]
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topic: varchar("topic", { length: 80 }).notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    version: integer("version").notNull(),
    correlationId: uuid("correlation_id").notNull(),
    payload: jsonb("payload").notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: createdAt()
  },
  (table) => [
    uniqueIndex("outbox_aggregate_version_unique").on(
      table.topic,
      table.aggregateId,
      table.version
    ),
    index("outbox_unpublished_idx").on(table.publishedAt, table.availableAt)
  ]
);
