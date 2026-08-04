import { createDatabase } from "@sale-advisor/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresTelegramLeadershipStore } from "./postgres-telegram-leadership.js";

const integration = process.env.RUN_TELEGRAM_LEADERSHIP_INTEGRATION === "true";

describe.runIf(integration)("PostgreSQL Telegram collector failover", () => {
  let database: ReturnType<typeof createDatabase>;

  beforeAll(async () => {
    database = createDatabase();
    await database.client`delete from collector_instances where instance_id like 'integration-%'`;
  });

  afterAll(async () => {
    await database!.client`delete from collector_instances where instance_id like 'integration-%'`;
    await database!.close();
  });

  it("releases leadership with the dedicated connection and lets standby take over", async () => {
    const active = new PostgresTelegramLeadershipStore();
    const standby = new PostgresTelegramLeadershipStore();
    try {
      expect(await active.tryAcquire("integration-active")).toBe(true);
      expect(await standby.tryAcquire("integration-standby")).toBe(false);
      await active.update("integration-active", {
        role: "active",
        state: "healthy",
        heartbeatAt: new Date()
      });
      await standby.update("integration-standby", {
        role: "standby",
        state: "starting",
        heartbeatAt: new Date()
      });

      await active.close();
      expect(await standby.tryAcquire("integration-standby")).toBe(true);
      await standby.update("integration-standby", {
        role: "active",
        state: "healthy",
        heartbeatAt: new Date()
      });

      const rows = await database!.client<{ active: number }[]>`
        select count(*)::int as active from collector_instances
        where instance_id like 'integration-%' and role = 'active'
      `;
      expect(rows[0]?.active).toBe(1);
    } finally {
      await standby.release("integration-standby");
      await standby.close();
    }
  });
});
