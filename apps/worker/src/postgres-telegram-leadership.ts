import { createDedicatedDatabaseConnection } from "@sale-advisor/database";

import type { CollectorInstanceUpdate, TelegramLeadershipStore } from "./telegram-leadership.js";

const TELEGRAM_COLLECTOR_LOCK_KEY = "sale-advisor:telegram-collector:v1";

export class PostgresTelegramLeadershipStore implements TelegramLeadershipStore {
  private readonly connection = createDedicatedDatabaseConnection();

  async tryAcquire(_instanceId: string) {
    const rows = await this.connection.client<{ acquired: boolean }[]>`
      select case
        when exists (
          select 1 from pg_locks
          where locktype = 'advisory' and pid = pg_backend_pid() and granted
        ) then true
        else pg_try_advisory_lock(hashtext(${TELEGRAM_COLLECTOR_LOCK_KEY}))
      end as acquired
    `;
    return rows[0]?.acquired ?? false;
  }

  async update(instanceId: string, update: CollectorInstanceUpdate) {
    await this.connection.client.begin(async (sql) => {
      if (update.role === "active") {
        await sql`
          update collector_instances set role = 'standby', state = 'stopped', updated_at = now()
          where integration_kind = 'telegram' and instance_id <> ${instanceId} and role = 'active'
        `;
      }
      await sql`
        insert into collector_instances (
          instance_id, integration_kind, role, state, heartbeat_at, last_message_at,
          retry_count, next_retry_at, last_error, updated_at
        ) values (
          ${instanceId}, 'telegram', ${update.role}::collector_role,
          coalesce(${update.state ?? null}::collector_state, 'starting'::collector_state), ${update.heartbeatAt},
          ${update.lastMessageAt ?? null}, ${update.retryCount ?? 0}, ${update.nextRetryAt ?? null},
          ${sql.json(JSON.parse(JSON.stringify(update.lastError ?? null)))}, now()
        ) on conflict (instance_id) do update set
          role = excluded.role,
          state = coalesce(${update.state ?? null}::collector_state, collector_instances.state),
          heartbeat_at = excluded.heartbeat_at,
          last_message_at = coalesce(excluded.last_message_at, collector_instances.last_message_at),
          retry_count = coalesce(${update.retryCount ?? null}::integer, collector_instances.retry_count),
          next_retry_at = case when ${update.nextRetryAt !== undefined} then excluded.next_retry_at else collector_instances.next_retry_at end,
          last_error = case when ${update.lastError !== undefined} then excluded.last_error else collector_instances.last_error end,
          updated_at = now()
      `;
    });
  }

  async release(instanceId: string) {
    await this.connection.client`
      update collector_instances set role = 'standby', state = 'stopped', updated_at = now()
      where instance_id = ${instanceId}
    `;
    await this.connection
      .client`select pg_advisory_unlock(hashtext(${TELEGRAM_COLLECTOR_LOCK_KEY}))`;
  }

  async close() {
    await this.connection.close();
  }
}
