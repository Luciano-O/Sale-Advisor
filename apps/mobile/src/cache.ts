import type { MobileOffer } from "./types";

export type FeedSource = "network" | "cache" | "starter";

export interface OfferCache {
  read(): Promise<MobileOffer[]>;
  replace(offers: MobileOffer[]): Promise<void>;
}

export async function loadFeed(
  cache: OfferCache,
  fetchOffers: () => Promise<MobileOffer[]>,
  starterOffers: MobileOffer[] = []
): Promise<{ offers: MobileOffer[]; source: FeedSource; error: string | null }> {
  try {
    const offers = await fetchOffers();
    await cache.replace(offers);
    return { offers, source: "network", error: null };
  } catch (error) {
    const cachedOffers = await cache.read();
    return {
      offers: cachedOffers.length > 0 ? cachedOffers : starterOffers,
      source: cachedOffers.length > 0 ? "cache" : "starter",
      error: error instanceof Error ? error.message : "Falha de rede"
    };
  }
}
