export interface ParserReportMessage {
  sourceKind: string;
  status: string;
  capturedAt: string;
  text: string;
  parse: {
    status: string;
    productModel: string | null;
    hasPrice: boolean;
    domain: string | null;
    adapterName: string | null;
    urlResolutionFailed: boolean;
  } | null;
  resolution: { status: string; originalUrl: string } | null;
}

export interface ParserReportInput {
  generatedAt: string;
  messages: ParserReportMessage[];
  /** Active price snapshots per product in the last 30 days. */
  productSnapshotCounts: number[];
}

export interface Count {
  key: string;
  count: number;
}

export interface ParserReport {
  generatedAt: string;
  totalMessages: number;
  bySourceKind: Count[];
  byStatus: Count[];
  incomplete: {
    total: number;
    missingProduct: number;
    missingPrice: number;
    missingStore: number;
    urlResolutionFailed: number;
  };
  gpuMentionsWithoutProduct: { total: number; topModels: Count[] };
  computerListingsMatchedAsGpu: number;
  genericStoreDomains: Count[];
  failedResolutionHosts: Count[];
  products: { total: number; withSufficientHistory: number };
  categoryCoverage: CategoryCoverage;
}

export type HardwareCategoryKey = "GPU" | "CPU" | "RAM" | "STORAGE" | "PSU" | "MOBO";

export interface CategoryCount {
  key: HardwareCategoryKey;
  label: string;
  total: number;
  last30Days: number;
  meetsGoal: boolean;
}

export interface CategoryCoverage {
  goalLast30Days: number;
  categories: CategoryCount[];
  /** Notebooks, assembled PCs and upgrade kits: never a component offer. */
  computersAndKits: number;
  uncategorized: number;
}

// Mirrors the minimum history required by scoreOffer before labelling above "normal".
const MINIMUM_SNAPSHOTS_FOR_SCORING = 3;
const TOP_LIMIT = 15;

const NVIDIA_MODEL_PATTERN = /\b(rtx|gtx)\s*-?\s*(\d{4})\s*(ti\s*super|ti|super)?\b/gi;
const AMD_MODEL_PATTERN = /\b(rx)\s*-?\s*(\d{4})\s*(xtx|xt|gre)?\b/gi;
// Fixture goal from the hardware categories roadmap (HW-01): 30 messages in 30 days.
const CATEGORY_GOAL_LAST_30_DAYS = 30;
const COVERAGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Keyword heuristics to measure source coverage only. They do not identify products; the
 * category router of HW-03 does that. Order follows the roadmap.
 */
const HARDWARE_CATEGORIES: { key: HardwareCategoryKey; label: string; pattern: RegExp }[] = [
  {
    key: "GPU",
    label: "Placa de vídeo",
    pattern: /\b(?:placa\s+de\s+v[ií]deo|geforce|arc\s*[ab]\d{3}|(?:rtx|gtx|rx)\s*-?\s*\d{4})/i
  },
  {
    key: "CPU",
    label: "Processador",
    pattern:
      /\b(?:processador|ryzen\s*\d|threadripper|athlon|xeon|core\s*(?:i[3579]|ultra\s*\d)|i[3579]-\d{4,5})/i
  },
  {
    key: "RAM",
    label: "Memória RAM",
    pattern:
      /(?:\bmem[oó]ria\s+(?:ram|ddr)|\bpente\s+de\s+mem[oó]ria|(?<![a-z])ddr[345]\b|\bso-?dimm\b)/i
  },
  {
    key: "STORAGE",
    label: "SSD / HD",
    pattern: /\b(?:ssd|nvme|hdd|hd\s+(?:interno|externo|sata)|disco\s+r[ií]gido)\b/i
  },
  {
    key: "PSU",
    label: "Fonte",
    pattern:
      /\b(?:fonte\s+(?:de\s+alimenta|atx|modular)|fonte\b[^\n]{0,60}?\b\d{3,4}\s*w\b|80\s*plus\b)/i
  },
  {
    key: "MOBO",
    label: "Placa-mãe",
    pattern: /\b(?:placa[\s-]*m[ãa]e|motherboard|(?<!\barc\s*)[abhxz][3-9]\d0[em]?(?:-\w+)?\b)/i
  }
];

const KIT_PATTERN = /\bkit\s+(?:upgrade|gamer)\b/i;

const COMPUTER_LISTING_PATTERN =
  /\b(notebook|laptop|pc\s*gamer|computador|desktop|all[\s-]*in[\s-]*one|console|playstation|xbox)\b/i;

export function buildParserReport(input: ParserReportInput): ParserReport {
  const incompleteParses = input.messages
    .map(({ parse }) => parse)
    .filter((parse) => parse !== null && parse.status !== "completed")
    .map((parse) => parse!);
  const withoutProduct = input.messages.filter(
    ({ parse }) => parse !== null && parse.productModel === null
  );
  const unmatchedModels = withoutProduct.map(({ text }) => extractGpuModels(text));

  return {
    generatedAt: input.generatedAt,
    totalMessages: input.messages.length,
    bySourceKind: countBy(input.messages.map(({ sourceKind }) => sourceKind)),
    byStatus: countBy(input.messages.map(({ status }) => status)),
    incomplete: {
      total: incompleteParses.length,
      missingProduct: incompleteParses.filter(({ productModel }) => productModel === null).length,
      missingPrice: incompleteParses.filter(({ hasPrice }) => !hasPrice).length,
      missingStore: incompleteParses.filter(({ domain }) => domain === null).length,
      urlResolutionFailed: incompleteParses.filter(({ urlResolutionFailed }) => urlResolutionFailed)
        .length
    },
    gpuMentionsWithoutProduct: {
      total: unmatchedModels.filter((models) => models.length > 0).length,
      topModels: countBy(unmatchedModels.flat()).slice(0, TOP_LIMIT)
    },
    computerListingsMatchedAsGpu: input.messages.filter(
      ({ parse, text }) => parse?.productModel && COMPUTER_LISTING_PATTERN.test(text)
    ).length,
    genericStoreDomains: countBy(
      input.messages.flatMap(({ parse }) =>
        parse?.adapterName === "generic" && parse.domain ? [parse.domain] : []
      )
    ).slice(0, TOP_LIMIT),
    failedResolutionHosts: countBy(
      input.messages.flatMap(({ resolution }) =>
        resolution?.status === "failed" ? [hostOf(resolution.originalUrl)] : []
      )
    ).slice(0, TOP_LIMIT),
    products: {
      total: input.productSnapshotCounts.length,
      withSufficientHistory: input.productSnapshotCounts.filter(
        (count) => count >= MINIMUM_SNAPSHOTS_FOR_SCORING
      ).length
    },
    categoryCoverage: buildCategoryCoverage(input)
  };
}

function buildCategoryCoverage(input: ParserReportInput): CategoryCoverage {
  const windowStart = Date.parse(input.generatedAt) - COVERAGE_WINDOW_MS;
  const counts = HARDWARE_CATEGORIES.map(({ key, label }) => ({
    key,
    label,
    total: 0,
    last30Days: 0
  }));
  let computersAndKits = 0;
  let uncategorized = 0;

  for (const { text, capturedAt } of input.messages) {
    if (COMPUTER_LISTING_PATTERN.test(text) || KIT_PATTERN.test(text)) {
      computersAndKits += 1;
      continue;
    }
    const recent = Date.parse(capturedAt) >= windowStart;
    let matched = false;
    HARDWARE_CATEGORIES.forEach(({ pattern }, index) => {
      if (!pattern.test(text)) return;
      matched = true;
      counts[index]!.total += 1;
      if (recent) counts[index]!.last30Days += 1;
    });
    if (!matched) uncategorized += 1;
  }

  return {
    goalLast30Days: CATEGORY_GOAL_LAST_30_DAYS,
    categories: counts.map((count) => ({
      ...count,
      meetsGoal: count.last30Days >= CATEGORY_GOAL_LAST_30_DAYS
    })),
    computersAndKits,
    uncategorized
  };
}

export function renderParserReport(report: ParserReport): string {
  const incomplete = report.incomplete;
  return [
    "# Relatório do parser",
    "",
    `Gerado em ${report.generatedAt}. Somente contagens agregadas; nenhum texto, preço ou URL.`,
    "",
    "## Mensagens",
    "",
    `Total: ${report.totalMessages}`,
    "",
    table("Origem", report.bySourceKind),
    "",
    table("Status", report.byStatus),
    "",
    "## Mensagens que não viraram oferta",
    "",
    "| Motivo | Mensagens |",
    "| --- | ---: |",
    `| Parse incompleto (total) | ${incomplete.total} |`,
    `| Sem produto canônico | ${incomplete.missingProduct} |`,
    `| Sem preço | ${incomplete.missingPrice} |`,
    `| Sem loja | ${incomplete.missingStore} |`,
    `| Falha ao resolver URL | ${incomplete.urlResolutionFailed} |`,
    "",
    "## Cobertura por categoria",
    "",
    `Contagem por palavras-chave. Meta para as fixtures: ${report.categoryCoverage.goalLast30Days} ` +
      "mensagens nos últimos 30 dias. Uma mensagem conta em cada categoria que cita.",
    "",
    "| Categoria | Chave | Total | Últimos 30 dias | Meta |",
    "| --- | --- | ---: | ---: | --- |",
    ...report.categoryCoverage.categories.map(
      ({ label, key, total, last30Days, meetsGoal }) =>
        `| ${label} | ${key} | ${total} | ${last30Days} | ${meetsGoal ? "atingida" : "sem fonte"} |`
    ),
    "",
    `Notebooks, PCs montados e kits (fora das categorias): ${report.categoryCoverage.computersAndKits}`,
    "",
    `Sem categoria de hardware: ${report.categoryCoverage.uncategorized}`,
    "",
    "## GPUs citadas sem produto canônico",
    "",
    `Mensagens: ${report.gpuMentionsWithoutProduct.total}`,
    "",
    table("Modelo", report.gpuMentionsWithoutProduct.topModels),
    "",
    "## Notebooks e computadores classificados como GPU",
    "",
    `Mensagens: ${report.computerListingsMatchedAsGpu}`,
    "",
    "## Domínios sem adaptador dedicado",
    "",
    table("Domínio", report.genericStoreDomains),
    "",
    "## Hosts com falha de redirecionamento",
    "",
    table("Host", report.failedResolutionHosts),
    "",
    "## Histórico de preços",
    "",
    `Produtos com pelo menos ${MINIMUM_SNAPSHOTS_FOR_SCORING} preços nos últimos 30 dias: ` +
      `${report.products.withSufficientHistory} de ${report.products.total}`,
    ""
  ].join("\n");
}

function extractGpuModels(text: string): string[] {
  const models = new Set<string>();
  for (const match of text.matchAll(NVIDIA_MODEL_PATTERN)) {
    const suffix = match[3] ? ` ${titleCase(match[3].replace(/\s+/g, " "))}` : "";
    models.add(`${match[1]!.toUpperCase()} ${match[2]}${suffix}`);
  }
  for (const match of text.matchAll(AMD_MODEL_PATTERN)) {
    const suffix = match[3] ? ` ${match[3].toUpperCase()}` : "";
    models.add(`RX ${match[2]}${suffix}`);
  }
  return [...models];
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "invalid-url";
  }
}

function countBy(values: string[]): Count[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function table(label: string, counts: Count[]): string {
  if (counts.length === 0) return `_Nenhum registro em ${label.toLowerCase()}._`;
  return [
    `| ${label} | Mensagens |`,
    "| --- | ---: |",
    ...counts.map(({ key, count }) => `| ${key} | ${count} |`)
  ].join("\n");
}
