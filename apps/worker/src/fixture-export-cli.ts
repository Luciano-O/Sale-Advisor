import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createDatabase } from "@sale-advisor/database";

import { anonymizeMessageText, sanitizeResolvedUrl, selectEvenly } from "./fixture-export.js";

interface ExportRow {
  text: string;
  capturedAt: Date;
  finalUrl: string | null;
  parseStatus: string | null;
  parserVersion: number | null;
  productModel: string | null;
  vramGb: number | null;
  priceInCents: number | null;
  domain: string | null;
}

const GPU_TEXT_PATTERN = /\b(rtx|gtx|rx\s*\d|radeon|geforce|arc\s*[ab]\d)|placa de v[ií]deo/i;
const GPU_SHARE = 0.8;

const limit = Number(
  process.argv.find((argument) => argument.startsWith("--limit="))?.split("=")[1] ?? 100
);
const outPath = resolve(
  process.argv.find((argument) => argument.startsWith("--out="))?.split("=")[1] ??
    "fixtures/telegram-real-messages.json"
);
const connection = createDatabase();

try {
  const rows = await connection.client<ExportRow[]>`
    select distinct on (rm.text) rm.text, rm.captured_at as "capturedAt",
      ur.final_url as "finalUrl", rp.status as "parseStatus", rp.parser_version as "parserVersion",
      rp.candidate->'product'->>'model' as "productModel",
      (rp.candidate->'product'->>'vramGb')::int as "vramGb",
      (rp.candidate->'price'->>'amountInCents')::int as "priceInCents",
      rp.candidate->>'domain' as domain
    from raw_messages rm join sources s on s.id = rm.source_id
    left join lateral (
      select status, parser_version, candidate, url_resolution_id from raw_message_parses
      where raw_message_id = rm.id order by version desc, created_at desc limit 1
    ) rp on true
    left join url_resolutions ur on ur.id = rp.url_resolution_id
    where s.kind = 'telegram'
    order by rm.text, rm.captured_at
  `;
  const chronological = [...rows].sort(
    (left, right) => left.capturedAt.getTime() - right.capturedAt.getTime()
  );
  const gpu = chronological.filter(({ text }) => GPU_TEXT_PATTERN.test(text));
  const other = chronological.filter(({ text }) => !GPU_TEXT_PATTERN.test(text));
  const gpuLimit = Math.min(gpu.length, Math.round(limit * GPU_SHARE));
  const selected = [...selectEvenly(gpu, gpuLimit), ...selectEvenly(other, limit - gpuLimit)].sort(
    (left, right) => left.capturedAt.getTime() - right.capturedAt.getTime()
  );

  const fixtures = selected.map((row, index) => ({
    id: `telegram-real-${String(index + 1).padStart(3, "0")}`,
    capturedAt: row.capturedAt.toISOString(),
    text: anonymizeMessageText(row.text),
    resolvedUrl: sanitizeResolvedUrl(row.finalUrl),
    // Parser output at export time; not reviewed ground truth.
    baseline: {
      parserVersion: row.parserVersion,
      status: row.parseStatus,
      productModel: row.productModel,
      vramGb: row.vramGb,
      priceInCents: row.priceInCents,
      domain: row.domain
    }
  }));
  await writeFile(outPath, `${JSON.stringify(fixtures, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify({ exported: fixtures.length, gpu: gpuLimit, other: fixtures.length - gpuLimit })
  );
} finally {
  await connection.close();
}
