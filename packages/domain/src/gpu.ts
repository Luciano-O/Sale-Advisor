import type { CanonicalGpuProduct, GpuVendor } from "./types.js";

// Controlled taxonomy: GPUs sold new in Brazil in 2026. Variants are separate models.
const NVIDIA_MODELS = [
  "RTX 3050",
  "RTX 3060",
  "RTX 3060 Ti",
  "RTX 3070",
  "RTX 3070 Ti",
  "RTX 3080",
  "RTX 4060",
  "RTX 4060 Ti",
  "RTX 4070",
  "RTX 4070 Super",
  "RTX 4070 Ti",
  "RTX 4070 Ti Super",
  "RTX 4080",
  "RTX 4080 Super",
  "RTX 4090",
  "RTX 5050",
  "RTX 5060",
  "RTX 5060 Ti",
  "RTX 5070",
  "RTX 5070 Ti",
  "RTX 5080",
  "RTX 5090"
];
const AMD_MODELS = [
  "RX 6500 XT",
  "RX 6600",
  "RX 6600 XT",
  "RX 6650 XT",
  "RX 6700 XT",
  "RX 6750 XT",
  "RX 6800",
  "RX 6800 XT",
  "RX 7600",
  "RX 7600 XT",
  "RX 7700 XT",
  "RX 7800 XT",
  "RX 7900 GRE",
  "RX 7900 XT",
  "RX 7900 XTX",
  "RX 9050",
  "RX 9060",
  "RX 9060 XT",
  "RX 9070",
  "RX 9070 XT",
  "RX 9070 GRE"
];

const TAXONOMY = new Map<string, GpuVendor>([
  ...NVIDIA_MODELS.map((model) => [model, "NVIDIA"] as const),
  ...AMD_MODELS.map((model) => [model, "AMD"] as const)
]);

// Longer suffixes first so "Ti Super" is not read as "Ti" and "XTX" not as "XT".
const MODEL_PATTERN =
  /\b(?:(rtx)\s*-?\s*(\d{4})\s*(ti\s*super|ti|super)?|(rx)\s*-?\s*(\d{4})\s*(xtx|xt|gre)?)\b/gi;
const VRAM_PATTERN = /\b(4|6|8|10|12|16|20|24|32)\s*gb\b/gi;
const COMPUTER_PATTERN =
  /\b(notebook|laptop|pc\s*gamer|computador|desktop|all[\s-]*in[\s-]*one|mini\s*pc|console|playstation|xbox)\b/i;
const GPU_PART_PATTERN = /placa\s*(de\s*)?(v[ií]deo|gr[aá]fica)|\bgpu\b/i;

export interface ProductAlias {
  alias: string;
  product: CanonicalGpuProduct;
}

// Admin aliases only fill gaps: a broad alias must not override a precise taxonomy match.
export function identifyGpuProduct(
  text: string,
  aliases: readonly ProductAlias[] = []
): CanonicalGpuProduct | null {
  const match = findFirstKnownModel(text);
  if (!match) return findAliasProduct(text, aliases);
  if (isComputerListing(text, match.index)) return null;

  const vramGb = extractVram(text, match.index, match.end);
  const id = `${match.vendor.toLowerCase()}-${match.model.toLowerCase().replace(/\s+/g, "-")}`;
  return {
    id: `${id}-${vramGb === null ? "unknown-vram" : `${vramGb}gb`}`,
    vendor: match.vendor,
    model: match.model,
    vramGb
  };
}

function findFirstKnownModel(text: string) {
  for (const match of text.matchAll(MODEL_PATTERN)) {
    const [, rtx, rtxNumber, rtxSuffix, , rxNumber, rxSuffix] = match;
    const model = rtx
      ? `RTX ${rtxNumber}${rtxSuffix ? ` ${titleCase(rtxSuffix)}` : ""}`
      : `RX ${rxNumber}${rxSuffix ? ` ${rxSuffix.toUpperCase()}` : ""}`;
    const vendor = TAXONOMY.get(model);
    if (vendor) return { model, vendor, index: match.index, end: match.index + match[0].length };
  }
  return null;
}

function findAliasProduct(
  text: string,
  aliases: readonly ProductAlias[]
): CanonicalGpuProduct | null {
  const lowerText = text.toLocaleLowerCase("pt-BR");
  const found = aliases
    .map(({ alias, product }) => ({ product, index: findWholeWord(lowerText, alias) }))
    .filter(({ index }) => index >= 0)
    .sort((left, right) => left.index - right.index)[0];
  if (!found || isComputerListing(text, found.index)) return null;
  return found.product;
}

function findWholeWord(lowerText: string, alias: string): number {
  const escaped = alias.toLocaleLowerCase("pt-BR").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return lowerText.search(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u"));
}

// A computer term before the GPU model means the offer is the computer, unless the text
// already introduced a GPU part ("Placa de vídeo para PC Gamer RTX 5060").
function isComputerListing(text: string, modelIndex: number): boolean {
  const beforeModel = text.slice(0, modelIndex);
  const computer = COMPUTER_PATTERN.exec(beforeModel);
  if (!computer) return false;
  return !GPU_PART_PATTERN.test(beforeModel.slice(0, computer.index));
}

function extractVram(text: string, modelStart: number, modelEnd: number): number | null {
  const amounts = [...text.matchAll(VRAM_PATTERN)].map((match) => ({
    value: Number.parseInt(match[1]!, 10),
    index: match.index
  }));
  const after = amounts.find(({ index }) => index >= modelEnd);
  const before = amounts.filter(({ index }) => index < modelStart).at(-1);
  return (after ?? before)?.value ?? null;
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
