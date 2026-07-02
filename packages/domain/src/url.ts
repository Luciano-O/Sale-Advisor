import type { NormalizedUrl } from "./types.js";

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

function isTrackingParam(param: string): boolean {
  const normalized = param.toLowerCase();
  return normalized.startsWith("utm_") || TRACKING_PARAMS.has(normalized);
}
