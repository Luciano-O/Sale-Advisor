import { formatWholeMoney } from "./format";

export interface VerdictPrices {
  priceCents: number;
  median30dInCents: number | null;
  lowest90dInCents: number | null;
}

export interface VerdictChartRow {
  key: "median" | "lowest" | "today";
  cents: number;
  percent: number;
}

export interface VerdictChart {
  rows: VerdictChartRow[];
  ticks: Array<{ cents: number; percent: number }>;
  /** Spans today and the median, where the "−11%" annotation sits. */
  bracket: { startPercent: number; endPercent: number; midPercent: number } | null;
}

// A real difference never reads as "R$ 0".
const difference = (cents: number) => formatWholeMoney(Math.max(Math.abs(cents), 100));

function medianPhrase(priceCents: number, median: number): string {
  if (priceCents === median) return "Igual à mediana de 30 dias";
  const side = priceCents < median ? "abaixo" : "acima";
  return `${difference(priceCents - median)} ${side} da mediana de 30 dias`;
}

export function verdictCaption({
  priceCents,
  median30dInCents: median,
  lowest90dInCents: lowest
}: VerdictPrices): string {
  if (median === null && lowest === null)
    return "Ainda estamos juntando o histórico de preços deste produto.";
  const isLowest = lowest !== null && priceCents <= lowest;
  const lowestPhrase =
    lowest === null || isLowest
      ? null
      : `${difference(priceCents - lowest)} acima da mínima de 90 dias`;
  const comparisons = [median === null ? null : medianPhrase(priceCents, median), lowestPhrase]
    .filter((phrase) => phrase !== null)
    .join(" e ");
  if (!isLowest) return `${comparisons}.`;
  const lowestSentence = "Menor preço dos últimos 90 dias.";
  return comparisons ? `${comparisons}. ${lowestSentence}` : lowestSentence;
}

const oneDecimal = (value: number) => Math.round(value * 10) / 10;

/** The smallest of 1, 2 or 5 times a power of ten that is not below the value. */
function niceStep(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return ([1, 2, 5, 10].find((factor) => factor * magnitude >= value) ?? 10) * magnitude;
}

/**
 * The axis starts below the cheapest price instead of at zero, otherwise a 10% difference would
 * be invisible. Prices that are all equal still get a range, so their bars have a length.
 */
export function verdictChart(prices: VerdictPrices): VerdictChart | null {
  const { priceCents, median30dInCents: median, lowest90dInCents: lowest } = prices;
  if (median === null && lowest === null) return null;
  const values = [priceCents, median, lowest].filter((value) => value !== null);
  const top = Math.max(...values);
  const bottom = Math.min(...values);
  const spread = Math.max(top - bottom, top * 0.05);
  const step = niceStep(spread / 2);
  const base = Math.max(0, Math.floor((bottom - spread * 0.75) / step) * step);
  const percentOf = (cents: number) => oneDecimal(((cents - base) / (top - base)) * 100);

  const rows: VerdictChartRow[] = [];
  if (median !== null) rows.push({ key: "median", cents: median, percent: percentOf(median) });
  if (lowest !== null) rows.push({ key: "lowest", cents: lowest, percent: percentOf(lowest) });
  rows.push({ key: "today", cents: priceCents, percent: percentOf(priceCents) });

  const ticks: VerdictChart["ticks"] = [];
  for (let cents = base; cents < top; cents += step)
    ticks.push({ cents, percent: percentOf(cents) });

  let bracket: VerdictChart["bracket"] = null;
  if (median !== null && median !== priceCents) {
    const startPercent = Math.min(percentOf(priceCents), percentOf(median));
    const endPercent = Math.max(percentOf(priceCents), percentOf(median));
    bracket = {
      startPercent,
      endPercent,
      midPercent: oneDecimal((startPercent + endPercent) / 2)
    };
  }
  return { rows, ticks, bracket };
}

const FULL_BAR_DISCOUNT = 20;

/** How much of an offer row's bar is filled. Only a price below the median fills it. */
export function discountBarPercent(discountPercent: number | null): number {
  if (discountPercent === null || discountPercent <= 0) return 0;
  return Math.min(100, Math.round((discountPercent / FULL_BAR_DISCOUNT) * 100));
}
