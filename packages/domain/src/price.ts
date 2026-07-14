import type { ParsedPrice, PaymentMethod, PriceQuote } from "./types.js";

interface PriceCandidate extends ParsedPrice {
  index: number;
  score: number;
}

const PRICE_PATTERN = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+|\d{3,6})(?:,(\d{2}))?/gi;
const PIX_PATTERN = /\b(?:pix|avista|a vista|à vista)\b/i;
const CASH_PATTERN = /\b(?:boleto|cash|dinheiro)\b/i;
const INSTALLMENT_PATTERN = /\b(?:\d{1,2}x|parcelad[oa]|parcela|sem juros)\b/i;

export function parsePrice(text: string): ParsedPrice | null {
  const best = selectEffectivePrice(parsePriceQuotes(text));
  if (!best) return null;

  return {
    amountInCents: best.totalInCents,
    currency: "BRL",
    paymentMethod: best.method,
    rawText: best.rawText
  };
}

export function parsePriceQuotes(text: string): PriceQuote[] {
  return collectPriceCandidates(text).map((candidate) => {
    const context = text.slice(
      Math.max(0, candidate.index - 32),
      Math.min(text.length, candidate.index + candidate.rawText.length + 40)
    );
    const installmentMatch = context.match(/\b(\d{1,2})x\b/i);
    const installments =
      candidate.paymentMethod === "installment" && installmentMatch?.[1]
        ? Number.parseInt(installmentMatch[1], 10)
        : null;
    const isInstallmentUnit =
      installments !== null &&
      /\bde\s*$/i.test(text.slice(Math.max(0, candidate.index - 8), candidate.index));
    const totalInCents = isInstallmentUnit
      ? candidate.amountInCents * installments
      : candidate.amountInCents;

    return {
      method: candidate.paymentMethod,
      amountInCents: candidate.amountInCents,
      installments,
      totalInCents,
      rawText: candidate.rawText
    };
  });
}

export function selectEffectivePrice(quotes: PriceQuote[]): PriceQuote | null {
  const priority: Record<PaymentMethod, number> = { pix: 0, cash: 1, installment: 2, unknown: 3 };
  return (
    [...quotes].sort(
      (left, right) =>
        priority[left.method] - priority[right.method] || left.totalInCents - right.totalInCents
    )[0] ?? null
  );
}

function collectPriceCandidates(text: string): PriceCandidate[] {
  const candidates: PriceCandidate[] = [];

  for (const match of text.matchAll(PRICE_PATTERN)) {
    const rawText = match[0].trim();
    const amount = match[1];

    if (!amount || !looksLikePrice(rawText, text, match.index ?? 0)) {
      continue;
    }

    const amountInCents = parseBrlAmountToCents(amount, match[2]);

    if (amountInCents === null) {
      continue;
    }

    const index = match.index ?? 0;
    const context = text.slice(
      Math.max(0, index - 24),
      Math.min(text.length, index + rawText.length + 32)
    );
    const paymentMethod = detectPaymentMethod(text, index, rawText.length);

    candidates.push({
      amountInCents,
      currency: "BRL",
      paymentMethod,
      rawText,
      index,
      score: scoreCandidate(paymentMethod, context)
    });
  }

  return candidates;
}

function looksLikePrice(rawText: string, fullText: string, index: number): boolean {
  if (isLikelyGpuModelNumber(fullText, index)) {
    return false;
  }

  if (/R\$/i.test(rawText) || rawText.includes(",") || rawText.includes(".")) {
    return true;
  }

  const context = fullText.slice(
    Math.max(0, index - 12),
    Math.min(fullText.length, index + rawText.length + 16)
  );
  return PIX_PATTERN.test(context) || CASH_PATTERN.test(context) || /\bpor\b/i.test(context);
}

function isLikelyGpuModelNumber(fullText: string, index: number): boolean {
  const before = fullText.slice(Math.max(0, index - 8), index);
  return /\b(?:rtx|rx)\s*$/i.test(before);
}

function parseBrlAmountToCents(
  integerPart: string,
  decimalPart: string | undefined
): number | null {
  const normalizedInteger = integerPart.replace(/\./g, "");

  if (!/^\d+$/.test(normalizedInteger)) {
    return null;
  }

  const reais = Number.parseInt(normalizedInteger, 10);
  const cents = decimalPart ? Number.parseInt(decimalPart, 10) : 0;

  if (!Number.isFinite(reais) || !Number.isFinite(cents)) {
    return null;
  }

  return reais * 100 + cents;
}

function detectPaymentMethod(text: string, index: number, length: number): PaymentMethod {
  const before = text.slice(Math.max(0, index - 24), index);
  const after = text.slice(index + length, Math.min(text.length, index + length + 24));
  if (/\b\d{1,2}x\s+(?:de\s*)?$/i.test(before) || /^\s*(?:em\s*)?\d{1,2}x\b/i.test(after)) {
    return "installment";
  }
  if (/\bpix\b[^;,]{0,12}$/i.test(before) || /^[^;,]{0,16}\bpix\b/i.test(after)) {
    return "pix";
  }
  if (
    /\b(?:boleto|cash|dinheiro|avista|a vista|à vista)\b[^;,]{0,12}$/i.test(before) ||
    /^[^;,]{0,16}\b(?:boleto|cash|dinheiro|avista|a vista|à vista)\b/i.test(after)
  ) {
    return "cash";
  }
  if (INSTALLMENT_PATTERN.test(`${before} ${after}`)) {
    return "installment";
  }
  return "unknown";
}

function scoreCandidate(paymentMethod: PaymentMethod, context: string): number {
  if (paymentMethod === "pix" || paymentMethod === "cash") {
    return 30;
  }

  if (paymentMethod === "installment") {
    return 5;
  }

  if (/\bou\b/i.test(context)) {
    return 10;
  }

  return 0;
}
