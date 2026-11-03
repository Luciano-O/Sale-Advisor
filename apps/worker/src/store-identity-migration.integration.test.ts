import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { createDatabase } from "@sale-advisor/database";
import { KNOWN_STORES } from "@sale-advisor/domain";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const integration = process.env.RUN_PIPELINE_INTEGRATION === "true";
const migration = readFileSync(
  new URL("../../../packages/database/migrations/0005_store_identity.sql", import.meta.url),
  "utf8"
);

class Rollback extends Error {}

describe.runIf(integration)("store identity migration", () => {
  let database: ReturnType<typeof createDatabase>;
  type Sql = Parameters<Parameters<typeof database.client.begin>[0]>[0];

  // Everything happens in a transaction that is rolled back, so other tests never see these rows.
  async function inRollback(test: (sql: Sql) => Promise<void>) {
    await database.client
      .begin(async (sql) => {
        await test(sql);
        throw new Rollback();
      })
      .catch((error: unknown) => {
        if (!(error instanceof Rollback)) throw error;
      });
  }

  async function addStore(sql: Sql, domain: string, name = domain) {
    const rows = await sql<{ id: string }[]>`
      insert into stores (domain, name) values (${domain}, ${name})
      on conflict (domain) do update set name = excluded.name, blocked_at = null returning id
    `;
    return rows[0]!.id;
  }

  async function addOffer(sql: Sql, storeId: string) {
    const products = await sql<{ id: string }[]>`
      insert into products (canonical_key, vendor, model)
      values (${`migration-${randomUUID()}`}, 'NVIDIA', 'Migration GPU') returning id
    `;
    const offers = await sql<{ id: string }[]>`
      insert into offers (product_id, store_id, current_price_in_cents, lowest_price_in_cents,
        price_bucket_in_cents, condition, first_seen_at, last_seen_at)
      values (${products[0]!.id}, ${storeId}, 199900, 199900, 200000, 'unknown', now(), now())
      returning id
    `;
    return offers[0]!.id;
  }

  async function storeOf(sql: Sql, offerId: string) {
    const rows = await sql<{ domain: string; name: string }[]>`
      select s.domain, s.name from offers o join stores s on s.id = o.store_id
      where o.id = ${offerId}
    `;
    return rows[0];
  }

  beforeAll(() => {
    database = createDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  it("names every store the domain package knows", async () => {
    await inRollback(async (sql) => {
      for (const { domain } of KNOWN_STORES) await addStore(sql, domain);
      await sql.unsafe(migration);

      const rows = await sql<{ domain: string; name: string }[]>`
        select domain, name from stores where domain in ${sql(KNOWN_STORES.map((s) => s.domain))}
      `;
      expect(rows.sort((a, b) => a.domain.localeCompare(b.domain))).toEqual(
        KNOWN_STORES.map(({ domain, name }) => ({ domain, name })).sort((a, b) =>
          a.domain.localeCompare(b.domain)
        )
      );
    });
  });

  it("keeps a name someone already chose", async () => {
    await inRollback(async (sql) => {
      await addStore(sql, "kabum.com.br", "Kabum (revisado)");
      await sql.unsafe(migration);

      const rows = await sql<{ name: string }[]>`
        select name from stores where domain = 'kabum.com.br'
      `;
      expect(rows[0]?.name).toBe("Kabum (revisado)");
    });
  });

  it("moves offers from a subdomain to the store, creating it when missing", async () => {
    await inRollback(async (sql) => {
      const shopeeOffer = await addOffer(sql, await addStore(sql, "live.shopee.com.br"));
      const aliexpressOffer = await addOffer(sql, await addStore(sql, "m.aliexpress.com"));
      await sql.unsafe(migration);

      expect(await storeOf(sql, shopeeOffer)).toEqual({
        domain: "shopee.com.br",
        name: "Shopee"
      });
      expect(await storeOf(sql, aliexpressOffer)).toEqual({
        domain: "aliexpress.com",
        name: "AliExpress"
      });
    });
  });

  it("blocks the affiliate tool, keeping its offers for audit", async () => {
    await inRollback(async (sql) => {
      const offerId = await addOffer(sql, await addStore(sql, "aceleraafiliado.com"));
      await sql.unsafe(migration);

      const rows = await sql<{ blocked: boolean }[]>`
        select s.blocked_at is not null as blocked from offers o
        join stores s on s.id = o.store_id where o.id = ${offerId}
      `;
      expect(rows[0]?.blocked).toBe(true);
    });
  });

  it("leaves stores it does not know untouched", async () => {
    await inRollback(async (sql) => {
      const offerId = await addOffer(sql, await addStore(sql, "loja-nova.example.br"));
      await sql.unsafe(migration);

      expect(await storeOf(sql, offerId)).toEqual({
        domain: "loja-nova.example.br",
        name: "loja-nova.example.br"
      });
    });
  });

  it("can run twice without changing the result", async () => {
    await inRollback(async (sql) => {
      const offerId = await addOffer(sql, await addStore(sql, "live.shopee.com.br"));
      await sql.unsafe(migration);
      await sql.unsafe(migration);

      expect(await storeOf(sql, offerId)).toEqual({ domain: "shopee.com.br", name: "Shopee" });
    });
  });
});
