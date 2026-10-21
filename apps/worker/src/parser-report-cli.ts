import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createDatabase } from "@sale-advisor/database";

import { buildParserReport, renderParserReport } from "./parser-report.js";
import type { ParserReportMessage } from "./parser-report.js";

interface MessageRow {
  sourceKind: string;
  status: string;
  text: string;
  parseStatus: string | null;
  productModel: string | null;
  hasPrice: boolean | null;
  domain: string | null;
  adapterName: string | null;
  urlResolutionFailed: boolean | null;
  resolutionStatus: string | null;
  originalUrl: string | null;
}

const outPath = process.argv.find((argument) => argument.startsWith("--out="))?.split("=")[1];
const sourceKind =
  process.argv.find((argument) => argument.startsWith("--source="))?.split("=")[1] ?? null;
const connection = createDatabase();

try {
  const rows = await connection.client<MessageRow[]>`
    select s.kind as "sourceKind", rm.status, rm.text,
      rp.status as "parseStatus",
      rp.candidate->'product'->>'model' as "productModel",
      jsonb_typeof(rp.candidate->'price') = 'object' as "hasPrice",
      rp.candidate->>'domain' as domain,
      rp.candidate->'store'->>'adapterName' as "adapterName",
      coalesce((rp.candidate->>'urlResolutionFailed')::boolean, false) as "urlResolutionFailed",
      ur.status as "resolutionStatus", ur.original_url as "originalUrl"
    from raw_messages rm join sources s on s.id = rm.source_id
    left join lateral (
      select status, candidate from raw_message_parses where raw_message_id = rm.id
      order by version desc, created_at desc limit 1
    ) rp on true
    left join lateral (
      select status, original_url from url_resolutions where raw_message_id = rm.id
      order by created_at desc limit 1
    ) ur on true
    where ${sourceKind}::text is null or s.kind::text = ${sourceKind}
  `;
  const snapshotCounts = await connection.client<{ count: number }[]>`
    select count(ps.id) filter (
      where ps.active and ps.observed_at >= now() - interval '30 days'
    )::int as count
    from products p
    left join offers o on o.product_id = p.id
    left join price_snapshots ps on ps.offer_id = o.id
    group by p.id
  `;

  const markdown = renderParserReport(
    buildParserReport({
      generatedAt: new Date().toISOString(),
      messages: rows.map(toReportMessage),
      productSnapshotCounts: snapshotCounts.map(({ count }) => count)
    })
  );
  if (outPath) {
    await writeFile(resolve(outPath), markdown, "utf8");
    console.log(`Relatório gravado em ${resolve(outPath)}`);
  } else {
    console.log(markdown);
  }
} finally {
  await connection.close();
}

function toReportMessage(row: MessageRow): ParserReportMessage {
  return {
    sourceKind: row.sourceKind,
    status: row.status,
    text: row.text,
    parse: row.parseStatus
      ? {
          status: row.parseStatus,
          productModel: row.productModel,
          hasPrice: row.hasPrice ?? false,
          domain: row.domain,
          adapterName: row.adapterName,
          urlResolutionFailed: row.urlResolutionFailed ?? false
        }
      : null,
    resolution:
      row.resolutionStatus && row.originalUrl
        ? { status: row.resolutionStatus, originalUrl: row.originalUrl }
        : null
  };
}
