import type { MobileOffer } from "./types";

export interface OfferCache {
  read(): Promise<MobileOffer[]>;
  replace(offers: MobileOffer[]): Promise<void>;
}

export async function loadFeed(
  cache: OfferCache,
  fetchOffers: () => Promise<MobileOffer[]>
): Promise<{ offers: MobileOffer[]; source: "network" | "cache"; error: string | null }> {
  try {
    const offers = await fetchOffers();
    await cache.replace(offers);
    return { offers, source: "network", error: null };
  } catch (error) {
    return {
      offers: await cache.read(),
      source: "cache",
      error: error instanceof Error ? error.message : "Falha de rede"
    };
  }
}
