import { createHash, randomUUID } from "node:crypto";

import { buildOfferCandidate, deduplicateOfferCandidates, scoreOffer } from "@sale-advisor/domain";
import type {
  ConsolidatedOffer,
  OfferCandidate,
  OfferMention,
  PriceSnapshot,
  ScoredOffer
} from "@sale-advisor/domain";

import { asNotificationSendError, type NotificationProvider } from "./notification.js";

type ProcessingStatus = "pending" | "partial" | "completed" | "failed";

interface RawMessageInput {
  text: string;
  capturedAt: string;
  url?: string;
  storeDomain?: string;
  notifyEligible: boolean;
}

interface RawMessage extends RawMessageInput {
  id: string;
  status: ProcessingStatus;
}
interface ParseRecord {
  id: string;
  rawMessageId: string;
  version: number;
  parserVersion: number;
  candidate: OfferCandidate;
  status: ProcessingStatus;
}
interface OutboxRecord {
  id: string;
  rawMessageId: string;
  createdAt: string;
  publishedAt: string | null;
}
interface Delivery {
  installationId: string;
  offerId: string;
  provider: string;
  status: "pending" | "sent" | "failed";
  attempts: number;
  error: string | null;
}

export interface WorkerRepository {
  rawMessages: RawMessage[];
  parses: ParseRecord[];
  offers: ConsolidatedOffer[];
  mentions: OfferMention[];
  snapshots: PriceSnapshot[];
  scores: Array<ScoredOffer & { offerId: string; inputHash: string }>;
  outbox: OutboxRecord[];
  deliveries: Delivery[];
  installations: Array<{ id: string; minimumLabel: string; token: string | null }>;
  withConsolidationLock<T>(fingerprints: string[], operation: () => Promise<T>): Promise<T>;
}

export class InMemoryWorkerRepository implements WorkerRepository {
  rawMessages: RawMessage[] = [];
  parses: ParseRecord[] = [];
  offers: ConsolidatedOffer[] = [];
  mentions: OfferMention[] = [];
  snapshots: PriceSnapshot[] = [];
  scores: Array<ScoredOffer & { offerId: string; inputHash: string }> = [];
  outbox: OutboxRecord[] = [];
  deliveries: Delivery[] = [];
  installations: Array<{ id: string; minimumLabel: string; token: string | null }> = [];
  private lock = Promise.resolve();

  addRawMessage(input: RawMessageInput): string {
    const id = randomUUID();
    this.rawMessages.push({ ...input, id, status: "pending" });
    this.outbox.push({
      id: randomUUID(),
      rawMessageId: id,
      createdAt: input.capturedAt,
      publishedAt: null
    });
    return id;
  }

  addInstallation(input: { id: string; minimumLabel: string; token?: string | null }) {
    this.installations.push({ ...input, token: input.token ?? null });
  }

  async withConsolidationLock<T>(_fingerprints: string[], operation: () => Promise<T>): Promise<T> {
    const previous = this.lock;
    let release = () => {};
    this.lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}

export class WorkerPipeline {
  constructor(
    private readonly repository: WorkerRepository,
    private readonly notifications: NotificationProvider
  ) {}

  async dispatchOutbox(): Promise<void> {
    const pending = this.repository.outbox
      .filter((event) => !event.publishedAt)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    for (const event of pending) {
      await this.processRawMessage(event.rawMessageId);
      event.publishedAt = new Date().toISOString();
    }
  }

  async processRawMessage(rawMessageId: string): Promise<void> {
    const raw = this.repository.rawMessages.find((item) => item.id === rawMessageId);
    if (!raw) throw new Error(`Raw message ${rawMessageId} not found`);
    let parse = this.repository.parses.find(
      (item) => item.rawMessageId === rawMessageId && item.parserVersion === 3
    );
    if (!parse) {
      const candidate = buildOfferCandidate({
        rawText: raw.text,
        capturedAt: raw.capturedAt,
        rawMessageId: raw.id,
        ...(raw.url ? { url: raw.url } : {}),
        ...(raw.storeDomain ? { storeDomain: raw.storeDomain } : {})
      });
      const complete = Boolean(candidate.product && candidate.price && candidate.store);
      parse = {
        id: randomUUID(),
        rawMessageId,
        version: 1,
        parserVersion: 3,
        candidate,
        status: complete ? "completed" : "partial"
      };
      this.repository.parses.push(parse);
    }
    raw.status = parse.status;
    if (parse.status !== "completed") return;
    const fingerprints = [
      parse.candidate.storeProductId ?? "",
      parse.candidate.normalizedUrl?.normalizedUrl ?? "",
      `${parse.candidate.product?.id}:${parse.candidate.domain}:${parse.candidate.priceBucketInCents}:${parse.candidate.coupon ?? ""}`
    ].sort();
    await this.repository.withConsolidationLock(fingerprints, async () =>
      this.rebuildConsolidation()
    );
    await this.notifyForMessage(rawMessageId);
  }

  async notifyForMessage(rawMessageId: string): Promise<void> {
    const raw = this.repository.rawMessages.find((item) => item.id === rawMessageId);
    const mention = this.repository.mentions.find((item) => item.rawMessageId === rawMessageId);
    if (!raw?.notifyEligible || !mention) return;
    const offer = this.repository.offers.find((item) => item.id === mention.offerId);
    if (!offer || Date.now() - Date.parse(offer.lastSeenAt) > 48 * 60 * 60 * 1_000) return;
    const score = [...this.repository.scores].reverse().find((item) => item.offerId === offer.id);
    const ranks: Record<string, number> = { normal: 0, boa: 1, muito_boa: 2, excepcional: 3 };
    let retryableFailure: Error | null = null;
    for (const installation of this.repository.installations) {
      if ((ranks[score?.label ?? "normal"] ?? 0) < (ranks[installation.minimumLabel] ?? 0))
        continue;
      let delivery = this.repository.deliveries.find(
        (item) => item.installationId === installation.id && item.offerId === offer.id
      );
      if (delivery?.status === "sent" || delivery?.status === "pending") continue;
      if (!delivery) {
        delivery = {
          installationId: installation.id,
          offerId: offer.id,
          provider: this.notifications.name,
          status: "pending",
          attempts: 1,
          error: null
        };
        this.repository.deliveries.push(delivery);
      } else {
        delivery.status = "pending";
        delivery.attempts += 1;
        delivery.error = null;
      }
      try {
        await this.notifications.send(
          { installationId: installation.id, token: installation.token },
          { offerId: offer.id }
        );
        delivery.status = "sent";
      } catch (error) {
        const failure = asNotificationSendError(error);
        delivery.status = "failed";
        delivery.error = failure.code;
        if (failure.retryable) retryableFailure ??= failure;
        else installation.token = null;
      }
    }
    if (retryableFailure) throw retryableFailure;
  }

  private async rebuildConsolidation(): Promise<void> {
    const completeCandidates = this.repository.parses
      .filter((item) => item.status === "completed")
      .map((item) => item.candidate);
    const result = deduplicateOfferCandidates(completeCandidates);
    this.repository.offers.splice(0, this.repository.offers.length, ...result.offers);
    this.repository.mentions.splice(0, this.repository.mentions.length, ...result.offerMentions);
    const snapshots: PriceSnapshot[] = result.offerMentions.flatMap((mention) => {
      const candidate = mention.candidate;
      const offer = result.offers.find((item) => item.id === mention.offerId);
      if (!candidate.price || !offer) return [];
      return [
        {
          offerId: offer.id,
          productId: offer.product.id,
          observedAt: candidate.capturedAt,
          amountInCents: candidate.price.amountInCents,
          domain: offer.domain,
          storeProductId: offer.storeProductId,
          mentionCount: offer.mentionCount
        }
      ];
    });
    this.repository.snapshots.splice(0, this.repository.snapshots.length, ...snapshots);
    for (const offer of result.offers) {
      const scored = scoreOffer({ ...offer, storeReliability: 50 }, snapshots);
      const inputHash = createHash("sha256")
        .update(
          JSON.stringify({
            price: offer.price.amountInCents,
            metrics: scored.metrics,
            reasons: scored.reasons
          })
        )
        .digest("hex");
      if (
        !this.repository.scores.some(
          (item) => item.offerId === offer.id && item.inputHash === inputHash
        )
      ) {
        this.repository.scores.push({ ...scored, offerId: offer.id, inputHash });
      }
    }
  }
}
