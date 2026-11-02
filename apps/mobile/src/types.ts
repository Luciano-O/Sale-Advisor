import type { OfferHistory, OfferSort } from "@sale-advisor/contracts";

export type { OfferSort };

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
  /** The feed lists only active offers; the detail also opens expired ones. */
  status: "active" | "expired";
  history: OfferHistory;
  url: string | null;
}

/** What the hidden offers list shows, even after the offer itself is gone. */
export interface HiddenOfferSnapshot {
  name: string;
  storeName: string;
  priceCents: number;
}

export type SubcategoryMode = "inteira" | "produtos";

export interface SubcategoryFollow {
  mode: SubcategoryMode;
  /** Stay saved while following the whole subcategory, for coming back to them. */
  products: string[];
}

export interface LocalPreferences {
  version: 2;
  onboardingCompleted: boolean;
  followAll: boolean;
  subcategories: Record<string, SubcategoryFollow>;
  blockedStores: string[];
  blockedBrands: string[];
  alertsEnabled: boolean;
  analyticsEnabled: boolean;
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
  version: 2,
  onboardingCompleted: false,
  followAll: false,
  subcategories: {},
  blockedStores: [],
  blockedBrands: [],
  alertsEnabled: false,
  analyticsEnabled: true
};
