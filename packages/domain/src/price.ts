import type { ParsedPrice, PaymentMethod } from "./types.js";

interface PriceCandidate extends ParsedPrice {
  index: number;
  score: number;
}

const PRICE_PATTERN = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+|\d{3,6})(?:,(\d{2}))?/gi;
const PIX_PATTERN = /\b(?:pix|avista|a vista|à vista)\b/i;
const CASH_PATTERN = /\b(?:boleto|cash|dinheiro)\b/i;
const INSTALLMENT_PATTERN = /\b(?:\d{1,2}x|parcelad[oa]|parcela|sem juros)\b/i;

export function parsePrice(text: string): ParsedPrice | null {
  const candidates = collectPriceCandidates(text);

  if (candidates.length === 0) {
    return null;
  }

  const [best] = candidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    if (right.amountInCents !== left.amountInCents) {
      return right.amountInCents - left.amountInCents;
    }

    return left.index - right.index;
  });

  if (!best) {
    return null;
  }

  return {
    amountInCents: best.amountInCents,
    currency: "BRL",
    paymentMethod: best.paymentMethod,
    rawText: best.rawText
  };
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
    const context = text.slice(Math.max(0, index - 24), Math.min(text.length, index + rawText.length + 32));
    const paymentMethod = detectPaymentMethod(context);

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

  const context = fullText.slice(Math.max(0, index - 12), Math.min(fullText.length, index + rawText.length + 16));
  return PIX_PATTERN.test(context) || CASH_PATTERN.test(context) || /\bpor\b/i.test(context);
}

function isLikelyGpuModelNumber(fullText: string, index: number): boolean {
  const before = fullText.slice(Math.max(0, index - 8), index);
  return /\b(?:rtx|rx)\s*$/i.test(before);
}

function parseBrlAmountToCents(integerPart: string, decimalPart: string | undefined): number | null {
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

function detectPaymentMethod(context: string): PaymentMethod {
  if (PIX_PATTERN.test(context)) {
    return "pix";
  }

  if (CASH_PATTERN.test(context) || /\b(?:avista|a vista|à vista)\b/i.test(context)) {
    return "cash";
  }

  if (INSTALLMENT_PATTERN.test(context)) {
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
