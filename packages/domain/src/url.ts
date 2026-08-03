import type { NormalizedUrl } from "./types.js";

const HTTP_URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const TRAILING_URL_PUNCTUATION = /[),.;:!?\]}]+$/;
const TELEGRAM_DOMAINS = new Set(["t.me", "telegram.me", "telegram.dog"]);

const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "msclkid",
  "ref",
  "tag",
  "affid",
  "affiliate",
  "campaign",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term"
]);

export function normalizeUrl(url: string): NormalizedUrl | null {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.hash = "";

    const removedTrackingParams: string[] = [];

    for (const key of Array.from(parsed.searchParams.keys())) {
      if (isTrackingParam(key)) {
        parsed.searchParams.delete(key);
        removedTrackingParams.push(key);
      }
    }

    parsed.searchParams.sort();

    return {
      originalUrl: url,
      normalizedUrl: parsed.toString(),
      domain: parsed.hostname,
      path: parsed.pathname,
      removedTrackingParams
    };
  } catch {
    return null;
  }
}

export function extractHttpUrls(text: string): string[] {
  return Array.from(text.matchAll(HTTP_URL_PATTERN), ([url]) =>
    url.replace(TRAILING_URL_PUNCTUATION, "")
  ).filter(Boolean);
}

export function selectPrimaryOfferUrl(urls: string[]): string | null {
  const validUrls = urls
    .map((original) => ({ original, normalized: normalizeUrl(original) }))
    .filter(
      (
        candidate
      ): candidate is {
        original: string;
        normalized: NormalizedUrl;
      } => candidate.normalized !== null
    );
  return (
    validUrls.find(({ normalized }) => !TELEGRAM_DOMAINS.has(normalized.domain))?.original ??
    validUrls[0]?.original ??
    null
  );
}

function isTrackingParam(param: string): boolean {
  const normalized = param.toLowerCase();
  return normalized.startsWith("utm_") || TRACKING_PARAMS.has(normalized);
}
