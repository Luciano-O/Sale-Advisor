import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { scoreOffersWithPriceHistory } from "@sale-advisor/domain";
import type {
  CanonicalGpuProduct,
  ConsolidatedOffer,
  NormalizedStore,
  ParsedPrice,
  PaymentMethod,
  PriceScoringOutput,
  StoreProductIdSource
} from "@sale-advisor/domain";

export interface ProcessScoringFixturesOptions {
  inputPath?: string;
  outputPath?: string;
}

const DEFAULT_INPUT_PATH = join(process.cwd(), "fixtures", "consolidated-offers.json");
const DEFAULT_OUTPUT_PATH = join(process.cwd(), "output", "scored-offers.json");
const PAYMENT_METHODS: readonly PaymentMethod[] = ["pix", "cash", "installment", "unknown"];
const STORE_PRODUCT_ID_SOURCES: readonly StoreProductIdSource[] = [
  "query:sku",
  "query:productId",
  "query:produtoId",
  "query:itemId",
  "query:id",
  "path:numeric-id",
  "none"
];

export function scoreConsolidatedOffers(offers: ConsolidatedOffer[]): PriceScoringOutput {
  return scoreOffersWithPriceHistory(offers);
}

export async function processScoringFixtureFile(
  options: ProcessScoringFixturesOptions = {}
): Promise<PriceScoringOutput> {
  const inputPath = options.inputPath ?? DEFAULT_INPUT_PATH;
  const outputPath = options.outputPath ?? DEFAULT_OUTPUT_PATH;
  const fixture = JSON.parse(await readFile(inputPath, "utf8"));
  const offers = parseConsolidatedOffersFixture(fixture);
  const result = scoreConsolidatedOffers(offers);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  return result;
}

function parseConsolidatedOffersFixture(value: unknown): ConsolidatedOffer[] {
  if (!isRecord(value) || !Array.isArray(value["offers"])) {
    throw new TypeError("consolidated-offers fixture must be an object with an offers array");
  }

  return value["offers"].map((item, index) => parseConsolidatedOffer(item, index));
}

function parseConsolidatedOffer(value: unknown, index: number): ConsolidatedOffer {
  if (!isRecord(value)) {
    throw new TypeError(`consolidated offer at index ${index} must be an object`);
  }

  if (
    !isRecord(value["product"]) ||
    !isRecord(value["price"]) ||
    !isRecord(value["store"]) ||
    typeof value["firstSeenAt"] !== "string" ||
    typeof value["lastSeenAt"] !== "string"
  ) {
    throw new TypeError(`consolidated offer at index ${index} must include product, price, store and timestamps`);
  }

  return {
    id: parseString(value, "id", index),
    product: parseProduct(value["product"], index),
    price: parsePrice(value["price"], index),
    priceBucketInCents: parseInteger(value, "priceBucketInCents", index),
    normalizedUrl: parseNullableString(value, "normalizedUrl", index),
    store: parseStore(value["store"], index),
    storeProductId: parseNullableString(value, "storeProductId", index),
    domain: parseString(value, "domain", index),
    firstSeenAt: parseIsoDate(parseString(value, "firstSeenAt", index), "firstSeenAt", index),
    lastSeenAt: parseIsoDate(parseString(value, "lastSeenAt", index), "lastSeenAt", index),
    mentionCount: parseInteger(value, "mentionCount", index)
  };
}

function parseProduct(value: Record<string, unknown>, index: number): CanonicalGpuProduct {
  const vendor = value["vendor"];

  if (vendor !== "NVIDIA" && vendor !== "AMD") {
    throw new TypeError(`consolidated offer at index ${index} has invalid product.vendor`);
  }

  return {
    id: parseString(value, "id", index),
    vendor,
    model: parseString(value, "model", index)
  };
}

function parsePrice(value: Record<string, unknown>, index: number): ParsedPrice {
  const currency = value["currency"];
  const paymentMethod = value["paymentMethod"];

  if (currency !== "BRL") {
    throw new TypeError(`consolidated offer at index ${index} has invalid price.currency`);
  }

  if (!isPaymentMethod(paymentMethod)) {
    throw new TypeError(`consolidated offer at index ${index} has invalid price.paymentMethod`);
  }

  return {
    amountInCents: parseInteger(value, "amountInCents", index),
    currency,
    paymentMethod,
    rawText: parseString(value, "rawText", index)
  };
}

function parseStore(value: Record<string, unknown>, index: number): NormalizedStore {
  const storeProductIdSource = value["storeProductIdSource"];

  if (!isStoreProductIdSource(storeProductIdSource)) {
    throw new TypeError(`consolidated offer at index ${index} has invalid store.storeProductIdSource`);
  }

  return {
    domain: parseString(value, "domain", index),
    adapterName: parseString(value, "adapterName", index),
    storeProductId: parseNullableString(value, "storeProductId", index),
    storeProductIdSource
  };
}

function parseString(value: Record<string, unknown>, field: string, index: number): string {
  const fieldValue = value[field];

  if (typeof fieldValue !== "string") {
    throw new TypeError(`consolidated offer at index ${index} must include string ${field}`);
  }

  return fieldValue;
}

function parseNullableString(value: Record<string, unknown>, field: string, index: number): string | null {
  const fieldValue = value[field];

  if (fieldValue === null) {
    return null;
  }

  if (typeof fieldValue !== "string") {
    throw new TypeError(`consolidated offer at index ${index} must include string or null ${field}`);
  }

  return fieldValue;
}

function parseInteger(value: Record<string, unknown>, field: string, index: number): number {
  const fieldValue = value[field];

  if (typeof fieldValue !== "number" || !Number.isInteger(fieldValue)) {
    throw new TypeError(`consolidated offer at index ${index} must include integer ${field}`);
  }

  return fieldValue;
}

function parseIsoDate(value: string, field: string, index: number): string {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    throw new TypeError(`consolidated offer at index ${index} must include valid ISO date ${field}`);
  }

  return new Date(timestamp).toISOString();
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && PAYMENT_METHODS.includes(value as PaymentMethod);
}

function isStoreProductIdSource(value: unknown): value is StoreProductIdSource {
  return typeof value === "string" && STORE_PRODUCT_ID_SOURCES.includes(value as StoreProductIdSource);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await processScoringFixtureFile();
  console.log(JSON.stringify({ priceSnapshots: result.priceSnapshots.length, scoredOffers: result.scoredOffers.length }));
}
