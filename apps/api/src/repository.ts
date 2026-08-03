import { createHash, randomUUID } from "node:crypto";

import type { ImportMessage } from "@sale-advisor/contracts";

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
  score: { label: string; qualityScore: number; confidence: string; reasons: string[] };
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

export interface ApiRepository {
  readonly kind: string;
  importMessages(request: ImportRequest): Promise<ImportResult>;
  listOffers(input: {
    limit: number;
    cursor?: string | undefined;
    minimumLabel?: string | undefined;
  }): Promise<{ items: PublicOffer[]; nextCursor: string | null }>;
  findOffer(id: string): Promise<PublicOffer | null>;
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
  ): Promise<number>;
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
    cursor?: string | undefined;
    minimumLabel?: string | undefined;
  }) {
    const labelRank: Record<string, number> = { normal: 0, boa: 1, muito_boa: 2, excepcional: 3 };
    const minimum = input.minimumLabel ? (labelRank[input.minimumLabel] ?? 0) : 0;
    const sorted = [...this.offers]
      .filter((offer) => (labelRank[offer.score.label] ?? 0) >= minimum)
      .sort(
        (left, right) =>
          (labelRank[right.score.label] ?? 0) - (labelRank[left.score.label] ?? 0) ||
          right.score.qualityScore - left.score.qualityScore ||
          right.firstSeenAt.localeCompare(left.firstSeenAt) ||
          right.id.localeCompare(left.id)
      );
    const offset = input.cursor
      ? Number.parseInt(Buffer.from(input.cursor, "base64url").toString("utf8"), 10)
      : 0;
    const items = sorted.slice(offset, offset + input.limit);
    const nextOffset = offset + items.length;
    return {
      items,
      nextCursor:
        nextOffset < sorted.length ? Buffer.from(String(nextOffset)).toString("base64url") : null
    };
  }

  async findOffer(id: string) {
    return this.offers.find((offer) => offer.id === id) ?? null;
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

  async addEvents(events: Array<{ id: string }>) {
    let accepted = 0;
    for (const event of events)
      if (!this.eventIds.has(event.id)) {
        this.eventIds.add(event.id);
        accepted += 1;
      }
    return accepted;
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

  publishOffer({ index }: { index: number }) {
    const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    this.offers.push({
      id,
      product: {
        id: "00000000-0000-4000-8000-000000000002",
        vendor: "NVIDIA",
        model: "RTX 4060",
        vramGb: 8
      },
      store: { name: "Shop", domain: "shop.example", reliability: 80 },
      priceInCents: 189900 - index * 1000,
      lowestPriceInCents: 189900 - index * 1000,
      coupon: null,
      condition: "new",
      url: `https://shop.example/${index}`,
      firstSeenAt: `2026-07-1${index + 1}T12:00:00.000Z`,
      lastSeenAt: `2026-07-1${index + 1}T12:00:00.000Z`,
      mentionCount: index + 1,
      score: {
        label: index === 2 ? "excepcional" : "boa",
        qualityScore: 70 + index,
        confidence: "high",
        reasons: ["fixture"]
      }
    });
  }
}
