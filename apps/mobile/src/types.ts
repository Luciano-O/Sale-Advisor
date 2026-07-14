export type ScoreLabel = "normal" | "boa" | "muito_boa" | "excepcional";

export interface MobileOffer {
  id: string;
  productId: string;
  product: { category: "GPU"; vendor: string; model: string; vramGb: number | null };
  store: { name: string; domain: string };
  effectivePriceCents: number;
  lowestPriceCents?: number;
  coupon?: string | null;
  condition?: string;
  label: ScoreLabel;
  qualityScore: number;
  scoreSummary: string;
  mentionCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  url: string | null;
}

export interface LocalPreferences {
  followedCategories: string[];
  followedModels: string[];
  blockedBrands: string[];
  blockedStores: string[];
  minimumLabel: ScoreLabel;
}

export type AnonymousEventName =
  | "app_opened"
  | "feed_refreshed"
  | "offer_viewed"
  | "offer_clicked"
  | "notification_received"
  | "notification_opened"
  | "product_followed"
  | "product_hidden"
  | "store_blocked";

export interface PendingEvent {
  id: string;
  installationId: string;
  name: AnonymousEventName;
  occurredAt: string;
  payload?: Record<string, string | number | boolean | null>;
  attempts: number;
}

export const DEFAULT_PREFERENCES: LocalPreferences = {
  followedCategories: ["GPU"],
  followedModels: [],
  blockedBrands: [],
  blockedStores: [],
  minimumLabel: "boa"
};
