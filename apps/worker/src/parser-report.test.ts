import { describe, expect, it } from "vitest";

import { buildParserReport, renderParserReport } from "./parser-report.js";
import type { ParserReportMessage } from "./parser-report.js";

function message(overrides: Partial<ParserReportMessage> = {}): ParserReportMessage {
  return {
    sourceKind: "telegram",
    status: "completed",
    text: "RTX 4060 8GB R$ 1.899 https://www.amazon.com.br/dp/B0C0000000",
    parse: {
      status: "completed",
      productModel: "RTX 4060",
      hasPrice: true,
      domain: "amazon.com.br",
      adapterName: "amazon-br",
      urlResolutionFailed: false
    },
    resolution: { status: "direct", originalUrl: "https://www.amazon.com.br/dp/B0C0000000" },
    ...overrides
  };
}

function incomplete(
  text: string,
  parse: Partial<NonNullable<ParserReportMessage["parse"]>>
): ParserReportMessage {
  return message({
    status: "partial",
    text,
    parse: {
      status: "partial",
      productModel: null,
      hasPrice: true,
      domain: "amazon.com.br",
      adapterName: "amazon-br",
      urlResolutionFailed: false,
      ...parse
    }
  });
}

describe("buildParserReport", () => {
  it("counts messages by source kind and processing status", () => {
    const report = buildParserReport({
      generatedAt: "2026-10-21T12:00:00.000Z",
      messages: [
        message(),
        message(),
        message({ sourceKind: "manual" }),
        message({ status: "partial" }),
        message({ status: "pending", parse: null, resolution: null })
      ],
      productSnapshotCounts: []
    });

    expect(report.totalMessages).toBe(5);
    expect(report.bySourceKind).toEqual([
      { key: "telegram", count: 4 },
      { key: "manual", count: 1 }
    ]);
    expect(report.byStatus).toEqual([
      { key: "completed", count: 3 },
      { key: "partial", count: 1 },
      { key: "pending", count: 1 }
    ]);
  });

  it("explains why parsed messages did not become offers", () => {
    const report = buildParserReport({
      generatedAt: "2026-10-21T12:00:00.000Z",
      messages: [
        message(),
        incomplete("Cupom de frete grátis", { hasPrice: false, domain: null, adapterName: null }),
        incomplete("RTX 9999 R$ 10", { productModel: null }),
        incomplete("Link quebrado", { urlResolutionFailed: true, domain: null, adapterName: null })
      ],
      productSnapshotCounts: []
    });

    expect(report.incomplete).toEqual({
      total: 3,
      missingProduct: 3,
      missingPrice: 1,
      missingStore: 2,
      urlResolutionFailed: 1
    });
  });

  it("lists GPU models mentioned in messages that matched no canonical product", () => {
    const report = buildParserReport({
      generatedAt: "2026-10-21T12:00:00.000Z",
      messages: [
        incomplete("Placa de vídeo RTX 5060 Ti 8GB por R$ 2.199", {}),
        incomplete("rtx5060ti 16gb R$ 2.899 e RTX 5060 Ti de novo", {}),
        incomplete("Radeon rx9070xt R$ 4.199", {}),
        incomplete("GeForce RTX 4070 Ti Super R$ 5.000", {}),
        incomplete("Mouse gamer R$ 99", {}),
        message({ text: "RTX 4060 R$ 1.899" })
      ],
      productSnapshotCounts: []
    });

    expect(report.gpuMentionsWithoutProduct).toEqual({
      total: 4,
      topModels: [
        { key: "RTX 5060 Ti", count: 2 },
        { key: "RTX 4070 Ti Super", count: 1 },
        { key: "RX 9070 XT", count: 1 }
      ]
    });
  });

  it("flags notebooks and complete computers that were matched as a GPU", () => {
    const report = buildParserReport({
      generatedAt: "2026-10-21T12:00:00.000Z",
      messages: [
        message({ text: "Notebook Gamer Acer Nitro RTX 4060 R$ 4.999" }),
        message({ text: "PC Gamer completo RTX 3060 R$ 3.500" }),
        message({ text: "Placa de vídeo RTX 4060 R$ 1.899" }),
        incomplete("Notebook com RTX 5050 R$ 4.200", {})
      ],
      productSnapshotCounts: []
    });

    expect(report.computerListingsMatchedAsGpu).toBe(2);
  });

  it("lists store domains without a dedicated adapter and hosts whose redirects failed", () => {
    const generic = { adapterName: "generic", productModel: "RTX 4060" };
    const report = buildParserReport({
      generatedAt: "2026-10-21T12:00:00.000Z",
      messages: [
        incomplete("RTX 4060", { ...generic, domain: "kabum.com.br" }),
        incomplete("RTX 4060", { ...generic, domain: "kabum.com.br" }),
        incomplete("RTX 4060", { ...generic, domain: "pichau.com.br" }),
        message({
          resolution: { status: "failed", originalUrl: "https://amzn.to/abc123" }
        }),
        message({
          resolution: { status: "failed", originalUrl: "https://www.bit.ly/xyz?ref=1" }
        }),
        message({
          resolution: { status: "failed", originalUrl: "https://amzn.to/zzz999" }
        }),
        message({ resolution: { status: "failed", originalUrl: "not a url" } })
      ],
      productSnapshotCounts: []
    });

    expect(report.genericStoreDomains).toEqual([
      { key: "kabum.com.br", count: 2 },
      { key: "pichau.com.br", count: 1 }
    ]);
    expect(report.failedResolutionHosts).toEqual([
      { key: "amzn.to", count: 2 },
      { key: "bit.ly", count: 1 },
      { key: "invalid-url", count: 1 }
    ]);
  });

  it("measures how many products have enough price history to be scored", () => {
    const report = buildParserReport({
      generatedAt: "2026-10-21T12:00:00.000Z",
      messages: [],
      productSnapshotCounts: [0, 2, 3, 7]
    });

    expect(report.products).toEqual({ total: 4, withSufficientHistory: 2 });
  });
});

describe("renderParserReport", () => {
  it("renders only aggregates, never message text, prices or URLs", () => {
    const report = buildParserReport({
      generatedAt: "2026-10-21T12:00:00.000Z",
      messages: [
        incomplete("Segredo do canal: RTX 5060 Ti por R$ 2.199 https://amzn.to/abc123", {
          urlResolutionFailed: true
        }),
        message({ resolution: { status: "failed", originalUrl: "https://amzn.to/abc123" } })
      ],
      productSnapshotCounts: [3]
    });

    const markdown = renderParserReport(report);

    expect(markdown).toContain("2026-10-21T12:00:00.000Z");
    expect(markdown).toContain("RTX 5060 Ti");
    expect(markdown).toContain("amzn.to");
    expect(markdown).not.toContain("Segredo");
    expect(markdown).not.toContain("2.199");
    expect(markdown).not.toContain("https://");
    expect(markdown).not.toContain("abc123");
  });
});
