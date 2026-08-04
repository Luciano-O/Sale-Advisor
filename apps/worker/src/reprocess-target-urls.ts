import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createDatabase } from "@sale-advisor/database";

interface Checkpoint {
  createdAt: string;
  id: string;
  processed: number;
}

interface TargetRow {
  id: string;
  createdAt: Date;
}

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
      '%mercadolivre.com.br%', '%shopee.com.br%'
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
            select id, created_at as "createdAt" from raw_messages
            where lower(coalesce(supplied_url, '') || ' ' || text) like any (array[
              '%aoferta.net%', '%s.shopee.com.br%', '%meli.la%', '%amazon.com.br%',
              '%mercadolivre.com.br%', '%shopee.com.br%'
            ])
              and (created_at, id) > (${checkpoint.createdAt}::timestamptz, ${checkpoint.id}::uuid)
            order by created_at, id limit 100
          `
        : await connection.client<TargetRow[]>`
            select id, created_at as "createdAt" from raw_messages
            where lower(coalesce(supplied_url, '') || ' ' || text) like any (array[
              '%aoferta.net%', '%s.shopee.com.br%', '%meli.la%', '%amazon.com.br%',
              '%mercadolivre.com.br%', '%shopee.com.br%'
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
      const last = rows.at(-1)!;
      checkpoint = {
        createdAt: last.createdAt.toISOString(),
        id: last.id,
        processed: (checkpoint?.processed ?? 0) + rows.length
      };
      await writeFile(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
      console.log(JSON.stringify({ batch: rows.length, processed: checkpoint.processed }));
    }
  }
} finally {
  await connection.close();
}

async function readCheckpoint(path: string): Promise<Checkpoint | null> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as Checkpoint;
    return parsed.createdAt && parsed.id && Number.isSafeInteger(parsed.processed) ? parsed : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
