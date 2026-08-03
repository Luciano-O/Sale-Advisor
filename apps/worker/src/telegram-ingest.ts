import { createHash, randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import type { OnApplicationShutdown } from "@nestjs/common";
import { createDatabase } from "@sale-advisor/database";
import { selectPrimaryOfferUrl } from "@sale-advisor/domain";

import type { TelegramCursorStore } from "./telegram-collector.js";
import type { TelegramIngestJobData } from "./telegram-queue.js";

export interface PersistTelegramMessageInput extends TelegramIngestJobData {
  sourceName: string;
  externalId: string;
  idempotencyKey: string;
  suppliedUrl: string | null;
}

export interface PersistTelegramMessageResult {
  rawMessageId: string;
  inserted: boolean;
}

export interface TelegramIngestRepository {
  persist(input: PersistTelegramMessageInput): Promise<PersistTelegramMessageResult>;
}

export class TelegramIngestService {
  constructor(private readonly repository: TelegramIngestRepository) {}

  async ingest(data: TelegramIngestJobData): Promise<PersistTelegramMessageResult> {
    const sourceName = `telegram:${data.peerId}`;
    const idempotencyKey = createHash("sha256")
      .update(`telegram:${data.peerId}:${data.messageId}`)
      .digest("hex");
    return this.repository.persist({
      ...data,
      sourceName,
      externalId: data.messageId,
      idempotencyKey,
      suppliedUrl: selectPrimaryOfferUrl(data.urls)
    });
  }
}

export class InMemoryTelegramIngestRepository implements TelegramIngestRepository {
  readonly sources: Array<{ id: string; name: string; kind: "telegram" }> = [];
  readonly rawMessages: Array<PersistTelegramMessageInput & { id: string; sourceId: string }> = [];
  readonly outbox: Array<{ aggregateId: string; version: number; topic: string }> = [];

  async persist(input: PersistTelegramMessageInput): Promise<PersistTelegramMessageResult> {
    let source = this.sources.find(({ name }) => name === input.sourceName);
    if (!source) {
      source = { id: randomUUID(), name: input.sourceName, kind: "telegram" };
      this.sources.push(source);
    }
    const existing = this.rawMessages.find(
      ({ idempotencyKey }) => idempotencyKey === input.idempotencyKey
    );
    if (existing) return { rawMessageId: existing.id, inserted: false };
    const rawMessageId = randomUUID();
    this.rawMessages.push({ ...input, id: rawMessageId, sourceId: source.id });
    this.outbox.push({ aggregateId: rawMessageId, version: 1, topic: "raw-message.created" });
    return { rawMessageId, inserted: true };
  }
}

@Injectable()
export class PostgresTelegramIngestRepository
  implements TelegramIngestRepository, TelegramCursorStore, OnApplicationShutdown
{
  private readonly connection = createDatabase();

  async get(peerId: string): Promise<string | null> {
    const rows = await this.connection.client<{ cursor: string | null }[]>`
      select max(rm.external_id::bigint)::text as cursor
      from raw_messages rm
      join sources s on s.id = rm.source_id
      where s.kind = 'telegram' and s.name = ${`telegram:${peerId}`}
        and rm.external_id ~ '^[0-9]+$'
    `;
    return rows[0]?.cursor ?? null;
  }

  async persist(input: PersistTelegramMessageInput): Promise<PersistTelegramMessageResult> {
    return this.connection.client.begin(async (sql) => {
      await sql`select pg_advisory_xact_lock(hashtext(${input.sourceName}))`;
      const existingSources = await sql<{ id: string }[]>`
        select id from sources where kind = 'telegram' and name = ${input.sourceName} limit 1
      `;
      const sourceId =
        existingSources[0]?.id ??
        (
          await sql<{ id: string }[]>`
            insert into sources (name, kind)
            values (${input.sourceName}, 'telegram')
            returning id
          `
        )[0]?.id;
      if (!sourceId) throw new Error("Could not create Telegram source");

      const inserted = await sql<{ id: string }[]>`
        insert into raw_messages (
          source_id, external_id, idempotency_key, text, original_payload,
          supplied_url, captured_at, notify_eligible
        ) values (
          ${sourceId}, ${input.externalId}, ${input.idempotencyKey}, ${input.text},
          ${sql.json(JSON.parse(JSON.stringify(input.originalPayload)))}, ${input.suppliedUrl}, ${input.capturedAt},
          ${input.notifyEligible}
        )
        on conflict (idempotency_key) do nothing
        returning id
      `;
      const existing =
        inserted[0] ??
        (
          await sql<{ id: string }[]>`
            select id from raw_messages where idempotency_key = ${input.idempotencyKey} limit 1
          `
        )[0];
      if (!existing) throw new Error("Could not persist Telegram raw message");
      await sql`
        insert into outbox_events (topic, aggregate_id, version, correlation_id, payload)
        values (
          'raw-message.created', ${existing.id}, 1, ${randomUUID()},
          ${sql.json({ rawMessageId: existing.id })}
        )
        on conflict (topic, aggregate_id, version) do nothing
      `;
      return { rawMessageId: existing.id, inserted: inserted.length > 0 };
    });
  }

  async onApplicationShutdown() {
    await this.connection.close();
  }
}
