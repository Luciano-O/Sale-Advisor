import type { MobileOffer, PendingEvent, ScoreLabel } from "./types";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000";

interface PublicOfferResponse {
  id: string;
  product: { id: string; vendor: string; model: string; vramGb: number | null };
  store: { name: string; domain: string };
  priceInCents: number;
  lowestPriceInCents: number;
  coupon: string | null;
  condition: string;
  url: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  mentionCount: number;
  score: { label: ScoreLabel; qualityScore: number; reasons: string[] };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers }
  });
  if (!response.ok) throw new Error(`API indisponível (${response.status})`);
  return (await response.json()) as T;
}

function mapOffer(offer: PublicOfferResponse): MobileOffer {
  const { id: productId, ...product } = offer.product;
  return {
    id: offer.id,
    productId,
    product: { category: "GPU", ...product },
    store: offer.store,
    effectivePriceCents: offer.priceInCents,
    lowestPriceCents: offer.lowestPriceInCents,
    coupon: offer.coupon,
    condition: offer.condition,
    label: offer.score.label,
    qualityScore: offer.score.qualityScore,
    scoreSummary: offer.score.reasons.join(" · ") || "Oferta avaliada pelo histórico",
    mentionCount: offer.mentionCount,
    firstSeenAt: offer.firstSeenAt,
    lastSeenAt: offer.lastSeenAt,
    url: offer.url
  };
}

export async function fetchOffers(): Promise<MobileOffer[]> {
  const response = await request<{ items: PublicOfferResponse[] }>("/v1/offers?limit=50");
  return response.items.map(mapOffer);
}

export async function fetchOffer(id: string): Promise<MobileOffer> {
  return mapOffer(await request<PublicOfferResponse>(`/v1/offers/${encodeURIComponent(id)}`));
}

export async function registerInstallation(id: string, appVersion: string): Promise<void> {
  await request("/v1/installations", {
    method: "POST",
    body: JSON.stringify({ id, platform: "android", appVersion })
  });
}

export async function updateBroadPreferences(id: string, minimumLabel: ScoreLabel): Promise<void> {
  await request(`/v1/installations/${encodeURIComponent(id)}/notification-preferences`, {
    method: "PUT",
    body: JSON.stringify({ category: "GPU", minimumLabel })
  });
}

export async function updatePushTarget(id: string, target: string | null): Promise<void> {
  await request(`/v1/installations/${encodeURIComponent(id)}/push-target`, {
    method: "PUT",
    body: JSON.stringify({ target, enabled: Boolean(target) })
  });
}

export async function sendEvents(events: PendingEvent[]): Promise<void> {
  await request("/v1/events/batch", {
    method: "POST",
    body: JSON.stringify({
      events: events.map(({ attempts: _attempts, ...event }) => event)
    })
  });
}
