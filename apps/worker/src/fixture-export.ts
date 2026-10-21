const LINK_PATTERN = /(?:https?:\/\/|\bt\.me\/)\S+/gi;
const HANDLE_PATTERN = /(^|[^\w.])@[A-Za-z0-9_]{4,}/g;
// Query parameters that identify a product rather than an affiliate or tracking campaign.
const PRODUCT_ID_PARAMS = new Set(["sku", "productid", "produtoid", "itemid", "id"]);
// Short-link hosts seen in real messages; an unresolved short link only carries an affiliate code.
const SHORTENER_HOSTS = new Set([
  "aoferta.net",
  "s.shopee.com.br",
  "meli.la",
  "amzn.to",
  "link.amazon",
  "a.aliexpress.com",
  "bit.ly",
  "cutt.ly",
  "t.me"
]);

export function anonymizeMessageText(text: string): string {
  let linkCount = 0;
  return text
    .replace(LINK_PATTERN, () => `https://link.invalid/${++linkCount}`)
    .replace(HANDLE_PATTERN, "$1@canal");
}

export function sanitizeResolvedUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (SHORTENER_HOSTS.has(parsed.hostname.replace(/^www\./, ""))) return null;
    const kept = [...parsed.searchParams].filter(([key]) =>
      PRODUCT_ID_PARAMS.has(key.toLowerCase())
    );
    const query = new URLSearchParams(kept).toString();
    return `${parsed.origin}${parsed.pathname}${query ? `?${query}` : ""}`;
  } catch {
    return null;
  }
}

export function selectEvenly<T>(items: T[], limit: number): T[] {
  if (items.length <= limit) return [...items];
  if (limit <= 1) return items.slice(0, limit);
  const step = (items.length - 1) / (limit - 1);
  return Array.from({ length: limit }, (_, index) => items[Math.round(index * step)]!);
}
