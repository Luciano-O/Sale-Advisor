import { isOfferRelevant } from "./filters";
import type { LocalPreferences, MobileOffer, ScoreLabel } from "./types";

export interface PushDependencies {
  getOffer(id: string): Promise<MobileOffer>;
  getPreferences(): Promise<LocalPreferences>;
  getHiddenIds(): Promise<Set<string>>;
  wasShown(offerId: string): Promise<boolean>;
  markShown(offerId: string): Promise<void>;
  showLocalNotification(offer: MobileOffer): Promise<void>;
}

const LABELS: readonly ScoreLabel[] = ["normal", "boa", "muito_boa", "excepcional"];

export async function handleOfferPush(
  data: Record<string, unknown>,
  dependencies: PushDependencies
): Promise<"invalid" | "duplicate" | "filtered" | "shown"> {
  const offerId = typeof data.offerId === "string" ? data.offerId : null;
  if (!offerId) return "invalid";
  if (await dependencies.wasShown(offerId)) return "duplicate";
  // The summary lets the app decide offline; older pushes and malformed summaries fall back
  // to fetching the offer.
  const [offer, preferences, hiddenIds] = await Promise.all([
    offerFromSummary(offerId, data.offer) ?? dependencies.getOffer(offerId),
    dependencies.getPreferences(),
    dependencies.getHiddenIds()
  ]);
  if (!isOfferRelevant(offer, preferences, hiddenIds)) return "filtered";
  await dependencies.showLocalNotification(offer);
  await dependencies.markShown(offerId);
  return "shown";
}

function offerFromSummary(offerId: string, value: unknown): MobileOffer | null {
  if (typeof value !== "string") return null;
  let summary: Record<string, unknown>;
  try {
    summary = JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
  const { productId, vendor, model, vramGb, storeName, storeDomain, priceCents, label } = summary;
  if (
    typeof productId !== "string" ||
    typeof vendor !== "string" ||
    typeof model !== "string" ||
    (vramGb !== null && typeof vramGb !== "number") ||
    typeof storeName !== "string" ||
    typeof storeDomain !== "string" ||
    typeof priceCents !== "number" ||
    !LABELS.includes(label as ScoreLabel)
  )
    return null;
  const now = new Date().toISOString();
  return {
    id: offerId,
    productId,
    product: { category: "GPU", vendor, model, vramGb },
    store: { name: storeName, domain: storeDomain },
    effectivePriceCents: priceCents,
    label: label as ScoreLabel,
    qualityScore: 0,
    scoreSummary: "",
    mentionCount: 1,
    firstSeenAt: now,
    lastSeenAt: now,
    url: null
  };
}
