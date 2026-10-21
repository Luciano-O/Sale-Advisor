import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createDatabase } from "@sale-advisor/database";

import { advanceCheckpoint, readCheckpoint } from "./reprocess-checkpoint.js";
import type { TargetRow } from "./reprocess-checkpoint.js";

const execute = process.argv.includes("--execute");
const checkpointPath = resolve(
  process.argv.find((argument) => argument.startsWith("--checkpoint="))?.split("=")[1] ??
    ".sale-advisor-reprocess-checkpoint.json"
);
const connection = createDatabase();

try {
  const counts = await connection.client<
    Array<{
      total: number;
      aoferta: number;
      shopeeShort: number;
      meli: number;
      amazon: number;
      mercadoLivre: number;
      shopee: number;
    }>
  >`
    select count(*)::int as total,
      count(*) filter (where lower(coalesce(supplied_url, '') || ' ' || text) like '%aoferta.net%')::int as aoferta,
      count(*) filter (where lower(coalesce(supplied_url, '') || ' ' || text) like '%s.shopee.com.br%')::int as "shopeeShort",
      count(*) filter (where lower(coalesce(supplied_url, '') || ' ' || text) like '%meli.la%')::int as meli,
      count(*) filter (where lower(coalesce(supplied_url, '') || ' ' || text) like '%amazon.com.br%')::int as amazon,
      count(*) filter (where lower(coalesce(supplied_url, '') || ' ' || text) like '%mercadolivre.com.br%')::int as "mercadoLivre",
      count(*) filter (where lower(coalesce(supplied_url, '') || ' ' || text) like '%shopee.com.br%')::int as shopee
    from raw_messages
    where lower(coalesce(supplied_url, '') || ' ' || text) like any (array[
      '%aoferta.net%', '%s.shopee.com.br%', '%meli.la%', '%amazon.com.br%',
      '%mercadolivre.com.br%', '%shopee.com.br%', '%amzn.to%', '%link.amazon%',
              '%a.aliexpress.com%', '%bit.ly%', '%cutt.ly%'
    ])
  `;
  console.log(
    JSON.stringify({
      mode: execute ? "execute" : "dry-run",
      total: counts[0]?.total ?? 0,
      targets: counts[0] ?? {}
    })
  );
  if (!execute) process.exitCode = 0;
  else {
    let checkpoint = await readCheckpoint(checkpointPath);
    while (true) {
      const rows = checkpoint
        ? await connection.client<TargetRow[]>`
            select id, created_at::text as "createdAt" from raw_messages
            where lower(coalesce(supplied_url, '') || ' ' || text) like any (array[
              '%aoferta.net%', '%s.shopee.com.br%', '%meli.la%', '%amazon.com.br%',
              '%mercadolivre.com.br%', '%shopee.com.br%', '%amzn.to%', '%link.amazon%',
              '%a.aliexpress.com%', '%bit.ly%', '%cutt.ly%'
            ])
              -- Bound as text: postgres.js would serialize a timestamptz parameter with millisecond precision.
              and (created_at, id) > (${checkpoint.createdAt}::text::timestamptz, ${checkpoint.id}::uuid)
            order by created_at, id limit 100
          `
        : await connection.client<TargetRow[]>`
            select id, created_at::text as "createdAt" from raw_messages
            where lower(coalesce(supplied_url, '') || ' ' || text) like any (array[
              '%aoferta.net%', '%s.shopee.com.br%', '%meli.la%', '%amazon.com.br%',
              '%mercadolivre.com.br%', '%shopee.com.br%', '%amzn.to%', '%link.amazon%',
              '%a.aliexpress.com%', '%bit.ly%', '%cutt.ly%'
            ])
            order by created_at, id limit 100
          `;
      if (rows.length === 0) break;
      await connection.client.begin(async (sql) => {
        for (const row of rows) {
          const versions = await sql<{ version: number }[]>`
            select coalesce(max(version), 0)::int + 1 as version
            from outbox_events where topic = 'raw-message.created' and aggregate_id = ${row.id}
          `;
          const version = versions[0]?.version ?? 1;
          await sql`
            insert into outbox_events (topic, aggregate_id, version, correlation_id, payload)
            values ('raw-message.created', ${row.id}, ${version}, ${randomUUID()},
              ${sql.json({ rawMessageId: row.id, reprocessing: true })})
            on conflict (topic, aggregate_id, version) do nothing
          `;
          await sql`update raw_messages set status = 'pending', updated_at = now() where id = ${row.id}`;
        }
      });
      checkpoint = advanceCheckpoint(checkpoint, rows);
      await writeFile(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
      console.log(JSON.stringify({ batch: rows.length, processed: checkpoint.processed }));
    }
  }
} finally {
  await connection.close();
}
