import { describe, expect, it } from "vitest";

import { buildParserReport, renderParserReport } from "./parser-report.js";
import type { ParserReportMessage } from "./parser-report.js";

function message(overrides: Partial<ParserReportMessage> = {}): ParserReportMessage {
  return {
    sourceKind: "telegram",
    status: "completed",
    capturedAt: "2026-10-20T12:00:00.000Z",
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

describe("buildParserReport category coverage", () => {
  const generatedAt = "2026-11-11T12:00:00.000Z";
  const recent = "2026-11-01T12:00:00.000Z";
  const old = "2026-09-01T12:00:00.000Z";

  function coverage(texts: string[], capturedAt = recent) {
    return buildParserReport({
      generatedAt,
      messages: texts.map((text) => message({ text, capturedAt, parse: null, resolution: null })),
      productSnapshotCounts: []
    }).categoryCoverage;
  }

  function totals(texts: string[]): Record<string, number> {
    return Object.fromEntries(coverage(texts).categories.map(({ key, total }) => [key, total]));
  }

  it("always lists the six hardware categories in roadmap order, even when empty", () => {
    expect(coverage([]).categories.map(({ key }) => key)).toEqual([
      "GPU",
      "CPU",
      "RAM",
      "STORAGE",
      "PSU",
      "MOBO"
    ]);
    expect(totals([])).toEqual({ GPU: 0, CPU: 0, RAM: 0, STORAGE: 0, PSU: 0, MOBO: 0 });
  });

  it("recognizes each category by its usual keywords in Brazilian offers", () => {
    expect(
      totals([
        "Placa de vídeo Gigabyte RTX 5060 8GB R$ 1.999",
        "Radeon rx9070xt R$ 4.199",
        "Processador AMD Ryzen 5 5600 R$ 599",
        "Intel Core i5-12400F por R$ 649",
        "Memória Kingston Fury Beast 16GB DDR4 3200MHz R$ 189",
        "Pente de memória 8GB R$ 99",
        "SSD Kingston NV3 1TB NVMe R$ 399",
        "HD externo Seagate 2TB R$ 450",
        "Fonte Corsair RM750e 750W 80 Plus Gold R$ 599",
        "Fonte MSI MAG A650BN 650W R$ 329",
        "Placa-mãe ASUS TUF B650M-Plus WiFi R$ 1.199",
        "Gigabyte B760M DS3H R$ 899"
      ])
    ).toEqual({ GPU: 2, CPU: 2, RAM: 2, STORAGE: 2, PSU: 2, MOBO: 2 });
  });

  it("counts a message once per category it mentions", () => {
    expect(totals(["Combo: Ryzen 7 5700X + RTX 4060 R$ 2.999"])).toMatchObject({ GPU: 1, CPU: 1 });
  });

  it("does not read GPU video memory or a phone's RAM as a memory offer", () => {
    expect(
      totals(["RTX 5060 Ti 16GB GDDR7 R$ 2.899", "Smartphone Galaxy A55 8GB RAM 256GB R$ 1.799"])
    ).toMatchObject({ GPU: 1, RAM: 0, STORAGE: 0 });
  });

  it("counts Intel Arc cards as GPU, not as a motherboard chipset", () => {
    expect(
      totals(["Intel Arc B580 12GB R$ 1.899", "Placa de vídeo ASRock Arc B570 10GB R$ 1.499"])
    ).toMatchObject({ GPU: 2, MOBO: 0 });
  });

  it("does not take an unrelated 'fonte' or a TV's HD resolution as a component", () => {
    expect(
      totals(["Fonte: site oficial da loja", "Smart TV 32 HD R$ 899", "Cupom de frete grátis"])
    ).toEqual({ GPU: 0, CPU: 0, RAM: 0, STORAGE: 0, PSU: 0, MOBO: 0 });
  });

  it("keeps notebooks, assembled PCs and upgrade kits out of component categories", () => {
    const result = coverage([
      "Notebook Gamer Acer Nitro RTX 4060 Ryzen 7 16GB DDR5 SSD 512GB R$ 4.999",
      "PC Gamer completo RTX 3060 Ryzen 5 5600 16GB R$ 3.500",
      "Kit upgrade Ryzen 5 5600 + B550M + 16GB DDR4 R$ 1.299",
      "Processador Ryzen 5 5600 R$ 599"
    ]);

    expect(result.computersAndKits).toBe(3);
    expect(Object.fromEntries(result.categories.map(({ key, total }) => [key, total]))).toEqual({
      GPU: 0,
      CPU: 1,
      RAM: 0,
      STORAGE: 0,
      PSU: 0,
      MOBO: 0
    });
  });

  it("counts messages that mention no hardware category", () => {
    const result = coverage([
      "Air Fryer Mondial R$ 299",
      "Cupom de 10% na loja",
      "SSD 1TB R$ 399",
      "Notebook Lenovo R$ 2.999"
    ]);

    expect(result.uncategorized).toBe(2);
  });

  it("measures the last 30 days against the 30-message fixture goal", () => {
    const fresh = Array.from({ length: 30 }, () => "Processador Ryzen 5 5600 R$ 599");
    const result = buildParserReport({
      generatedAt,
      messages: [
        ...fresh.map((text) => message({ text, capturedAt: recent })),
        message({ text: "SSD 1TB R$ 399", capturedAt: recent }),
        ...Array.from({ length: 40 }, () => message({ text: "SSD 1TB R$ 399", capturedAt: old })),
        // Exactly 30 days before generatedAt is still inside the window.
        message({ text: "Fonte 650W R$ 329", capturedAt: "2026-10-12T12:00:00.000Z" }),
        message({ text: "Fonte 650W R$ 329", capturedAt: "2026-10-12T11:59:59.000Z" })
      ],
      productSnapshotCounts: []
    }).categoryCoverage;

    const byKey = Object.fromEntries(result.categories.map((category) => [category.key, category]));
    expect(result.goalLast30Days).toBe(30);
    expect(byKey.CPU).toMatchObject({ total: 30, last30Days: 30, meetsGoal: true });
    expect(byKey.STORAGE).toMatchObject({ total: 41, last30Days: 1, meetsGoal: false });
    expect(byKey.PSU).toMatchObject({ total: 2, last30Days: 1, meetsGoal: false });
  });
});

describe("renderParserReport", () => {
  it("renders the category coverage table with the goal status", () => {
    const report = buildParserReport({
      generatedAt: "2026-11-11T12:00:00.000Z",
      messages: [
        message({ text: "Processador Ryzen 5 5600 R$ 599", capturedAt: "2026-11-10T12:00:00.000Z" })
      ],
      productSnapshotCounts: []
    });

    const markdown = renderParserReport(report);

    expect(markdown).toContain("## Cobertura por categoria");
    expect(markdown).toContain("| Processador | CPU | 1 | 1 | sem fonte |");
    expect(markdown).toContain("| Placa-mãe | MOBO | 0 | 0 | sem fonte |");
    expect(markdown).toContain("Notebooks, PCs montados e kits");
    expect(markdown).toContain("Sem categoria de hardware");
  });

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
