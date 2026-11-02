import { createHash, randomUUID } from "node:crypto";

import type { ImportMessage, OfferHistory, OfferSort } from "@sale-advisor/contracts";

export const API_REPOSITORY = Symbol("API_REPOSITORY");
export const ADMIN_API_KEY = Symbol("ADMIN_API_KEY");

export interface ImportRequest {
  source: { name: string; kind: "manual" | "import" };
  notifyEligible: boolean;
  messages: ImportMessage[];
}

export interface ImportResult {
  batchId: string;
  messageIds: string[];
}

export interface PublicOffer {
  id: string;
  product: { id: string; vendor: string; model: string; vramGb: number | null };
  store: { name: string; domain: string; reliability: number };
  priceInCents: number;
  lowestPriceInCents: number;
  coupon: string | null;
  condition: string;
  url: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  mentionCount: number;
  /** The feed lists only active offers; the detail also opens expired ones. */
  status: "active" | "expired";
  history: OfferHistory;
  score: { label: string; qualityScore: number; confidence: string; reasons: string[] };
}

/** A store the app can block, picked from a list instead of typed. */
export interface PublicStore {
  name: string;
  domain: string;
}

export interface IntegrationHealth {
  kind: "telegram";
  enabled: boolean;
  status: "disabled" | "healthy" | "unavailable" | "retrying" | "blocked";
  heartbeatAt: string | null;
  lastMessageAt: string | null;
  activeInstanceId: string | null;
  configuredSourceCount: number;
  persistedSourceCount: number;
  instances: { active: number; standby: number };
  queues: { waiting: number; active: number; failed: number };
  retryCount: number;
  nextRetryAt: string | null;
  lastError: Record<string, unknown> | null;
}

export interface RuntimeHealth {
  checks: { database: "up"; redis: "up" };
  outboxPending: number;
}

export interface CatalogModel {
  category: "GPU";
  vendor: string;
  model: string;
}

/** A feed cursor that was not produced by this API; answered with 400. */
export class InvalidCursorError extends Error {
  constructor() {
    super("invalid_cursor");
    this.name = "InvalidCursorError";
  }
}

/** Event batches are all-or-nothing: an unknown installation rejects the whole batch. */
export type AddEventsResult =
  { status: "accepted"; acceptedCount: number } | { status: "unknown_installation" };

export interface ApiRepository {
  readonly kind: string;
  importMessages(request: ImportRequest): Promise<ImportResult>;
  listOffers(input: {
    limit: number;
    sort?: OfferSort | undefined;
    cursor?: string | undefined;
    minimumLabel?: string | undefined;
  }): Promise<{ items: PublicOffer[]; nextCursor: string | null }>;
  /** Also finds expired offers, so an old notification still opens; never blocked stores. */
  findOffer(id: string): Promise<PublicOffer | null>;
  listStores(): Promise<PublicStore[]>;
  /** Distinct GPU models seen in offers, for choosing followed models in the app. */
  listCatalog(): Promise<CatalogModel[]>;
  upsertInstallation(input: { id: string; platform: string; appVersion: string }): Promise<void>;
  updatePushTarget(
    id: string,
    input: { target: string | null; enabled: boolean }
  ): Promise<boolean>;
  updatePreferences(
    id: string,
    input: { category: string; minimumLabel: string }
  ): Promise<boolean>;
  addEvents(
    events: Array<{
      id: string;
      installationId: string;
      name: string;
      occurredAt: string;
      payload?: Record<string, string | number | boolean | null> | undefined;
    }>
  ): Promise<AddEventsResult>;
  health(): Promise<RuntimeHealth>;
  adminDashboard(): Promise<Record<string, unknown>>;
  adminIntegrations(): Promise<{ integrations: IntegrationHealth[] }>;
  adminList(resource: "messages" | "offers" | "products" | "sources" | "audit"): Promise<unknown[]>;
  adminAction(action: string, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export class InMemoryApiRepository implements ApiRepository {
  readonly kind = "memory";
  readonly rawMessages: Array<
    ImportMessage & { id: string; sourceKey: string; notifyEligible: boolean }
  > = [];
  readonly outbox: Array<{ id: string; aggregateId: string; topic: string }> = [];
  readonly audit: Array<{ id: string; action: string; payload: Record<string, unknown> }> = [];
  private readonly offers: PublicOffer[] = [];
  private readonly installations = new Map<
    string,
    { platform: string; appVersion: string; target?: string | null; enabled?: boolean }
  >();
  private readonly preferences = new Map<string, { category: string; minimumLabel: string }>();
  private readonly eventIds = new Set<string>();

  async importMessages(request: ImportRequest): Promise<ImportResult> {
    const sourceKey = `${request.source.kind}:${request.source.name.toLocaleLowerCase("pt-BR")}`;
    const messageIds = request.messages.map((message) => {
      const idempotencyKey = createHash("sha256")
        .update(`${sourceKey}:${message.externalId ?? `${message.capturedAt}:${message.text}`}`)
        .digest("hex");
      const existing = this.rawMessages.find(
        (item) => item.sourceKey === sourceKey && item.id === idempotencyKey
      );
      if (existing) return existing.id;
      this.rawMessages.push({
        ...message,
        id: idempotencyKey,
        sourceKey,
        notifyEligible: request.notifyEligible
      });
      this.outbox.push({
        id: randomUUID(),
        aggregateId: idempotencyKey,
        topic: "raw-message.created"
      });
      return idempotencyKey;
    });
    return { batchId: randomUUID(), messageIds };
  }

  async listOffers(input: {
    limit: number;
    sort?: OfferSort | undefined;
    cursor?: string | undefined;
    minimumLabel?: string | undefined;
  }) {
    const sort = input.sort ?? "recent";
    const labelRank: Record<string, number> = { normal: 0, boa: 1, muito_boa: 2, excepcional: 3 };
    const minimum = input.minimumLabel ? (labelRank[input.minimumLabel] ?? 0) : 0;
    const discount = (offer: PublicOffer) =>
      offer.history.discountVsMedianPercent ?? Number.NEGATIVE_INFINITY;
    const sorted = this.offers
      .filter(
        (offer) => offer.status === "active" && (labelRank[offer.score.label] ?? 0) >= minimum
      )
      .sort(
        (left, right) =>
          (sort === "discount" ? discount(right) - discount(left) || 0 : 0) ||
          right.firstSeenAt.localeCompare(left.firstSeenAt) ||
          right.id.localeCompare(left.id)
      );
    // The cursor names its ordering, so a page of one ordering never continues the other.
    const [cursorSort, rawOffset] = input.cursor
      ? Buffer.from(input.cursor, "base64url").toString("utf8").split(":")
      : [sort, "0"];
    const offset = Number(rawOffset);
    if (cursorSort !== sort || !Number.isSafeInteger(offset) || offset < 0)
      throw new InvalidCursorError();
    const items = sorted.slice(offset, offset + input.limit);
    const nextOffset = offset + items.length;
    return {
      items,
      nextCursor:
        nextOffset < sorted.length
          ? Buffer.from(`${sort}:${nextOffset}`).toString("base64url")
          : null
    };
  }

  async findOffer(id: string) {
    return this.offers.find((offer) => offer.id === id) ?? null;
  }

  async listStores(): Promise<PublicStore[]> {
    const stores = new Map<string, PublicStore>();
    for (const { store } of this.offers)
      stores.set(store.domain, { name: store.name, domain: store.domain });
    return [...stores.values()].sort(
      (left, right) =>
        left.name.localeCompare(right.name) || left.domain.localeCompare(right.domain)
    );
  }

  async listCatalog(): Promise<CatalogModel[]> {
    const models = new Map<string, CatalogModel>();
    for (const { product } of this.offers)
      models.set(`${product.vendor}|${product.model}`, {
        category: "GPU",
        vendor: product.vendor,
        model: product.model
      });
    return [...models.values()].sort(
      (left, right) =>
        left.vendor.localeCompare(right.vendor) || left.model.localeCompare(right.model)
    );
  }

  async upsertInstallation(input: { id: string; platform: string; appVersion: string }) {
    this.installations.set(input.id, {
      ...this.installations.get(input.id),
      platform: input.platform,
      appVersion: input.appVersion
    });
  }

  async updatePushTarget(id: string, input: { target: string | null; enabled: boolean }) {
    const current = this.installations.get(id);
    if (!current) return false;
    this.installations.set(id, { ...current, ...input });
    return true;
  }

  async updatePreferences(id: string, input: { category: string; minimumLabel: string }) {
    if (!this.installations.has(id)) return false;
    this.preferences.set(id, input);
    return true;
  }

  async addEvents(events: Array<{ id: string; installationId: string }>): Promise<AddEventsResult> {
    if (events.some((event) => !this.installations.has(event.installationId)))
      return { status: "unknown_installation" };
    let acceptedCount = 0;
    for (const event of events)
      if (!this.eventIds.has(event.id)) {
        this.eventIds.add(event.id);
        acceptedCount += 1;
      }
    return { status: "accepted", acceptedCount };
  }

  async health() {
    return {
      checks: { database: "up" as const, redis: "up" as const },
      outboxPending: this.outbox.length
    };
  }

  async adminDashboard() {
    return {
      pending: this.rawMessages.length,
      partial: 0,
      failed: 0,
      outboxPending: this.outbox.length,
      offersByLabel: Object.fromEntries(
        ["normal", "boa", "muito_boa", "excepcional"].map((label) => [
          label,
          this.offers.filter((offer) => offer.score.label === label).length
        ])
      )
    };
  }

  async adminIntegrations() {
    return {
      integrations: [
        {
          kind: "telegram" as const,
          enabled: false,
          status: "disabled" as const,
          heartbeatAt: null,
          lastMessageAt: null,
          activeInstanceId: null,
          configuredSourceCount: 0,
          persistedSourceCount: 0,
          instances: { active: 0, standby: 0 },
          queues: { waiting: 0, active: 0, failed: 0 },
          retryCount: 0,
          nextRetryAt: null,
          lastError: null
        }
      ]
    };
  }

  async adminList(resource: "messages" | "offers" | "products" | "sources" | "audit") {
    if (resource === "messages") return this.rawMessages;
    if (resource === "offers") return this.offers;
    if (resource === "audit") return this.audit;
    return [];
  }

  async adminAction(action: string, payload: Record<string, unknown>) {
    if (action === "message.reprocess") {
      const id = String(payload.id);
      const message = this.rawMessages.find((item) => item.id === id);
      if (!message) return { found: false };
      this.outbox.push({ id: randomUUID(), aggregateId: id, topic: "raw-message.created" });
    }
    const event = { id: randomUUID(), action, payload };
    this.audit.push(event);
    return { found: true, auditId: event.id };
  }

  publishOffer({
    index,
    status = "active",
    discountVsMedianPercent = 5,
    store = { name: "Shop", domain: "shop.example" }
  }: {
    index: number;
    status?: PublicOffer["status"];
    discountVsMedianPercent?: number | null;
    store?: PublicStore;
  }) {
    const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    this.offers.push({
      id,
      product: {
        id: "00000000-0000-4000-8000-000000000002",
        vendor: "NVIDIA",
        model: "RTX 4060",
        vramGb: 8
      },
      store: { ...store, reliability: 80 },
      priceInCents: 189900 - index * 1000,
      lowestPriceInCents: 189900 - index * 1000,
      coupon: null,
      condition: "new",
      url: `https://shop.example/${index}`,
      firstSeenAt: `2026-07-1${index + 1}T12:00:00.000Z`,
      lastSeenAt: `2026-07-1${index + 1}T12:00:00.000Z`,
      mentionCount: index + 1,
      status,
      history:
        discountVsMedianPercent === null
          ? { median30dInCents: null, lowest90dInCents: null, discountVsMedianPercent: null }
          : { median30dInCents: 200000, lowest90dInCents: 185000, discountVsMedianPercent },
      score: {
        label: index === 2 ? "excepcional" : "boa",
        qualityScore: 70 + index,
        confidence: "high",
        reasons: ["fixture"]
      }
    });
  }
}
