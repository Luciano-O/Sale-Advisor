import { isOfferRelevant } from "./filters";
import type { LocalPreferences, MobileOffer } from "./types";

export interface PushDependencies {
  getOffer(id: string): Promise<MobileOffer>;
  getPreferences(): Promise<LocalPreferences>;
  getHiddenIds(): Promise<Set<string>>;
  wasShown(offerId: string): Promise<boolean>;
  markShown(offerId: string): Promise<void>;
  showLocalNotification(offer: MobileOffer): Promise<void>;
}

export async function handleOfferPush(
  data: Record<string, unknown>,
  dependencies: PushDependencies
): Promise<"invalid" | "duplicate" | "filtered" | "shown"> {
  const offerId = typeof data.offerId === "string" ? data.offerId : null;
  if (!offerId) return "invalid";
  if (await dependencies.wasShown(offerId)) return "duplicate";
  const [offer, preferences, hiddenIds] = await Promise.all([
    dependencies.getOffer(offerId),
    dependencies.getPreferences(),
    dependencies.getHiddenIds()
  ]);
  if (!isOfferRelevant(offer, preferences, hiddenIds)) return "filtered";
  await dependencies.showLocalNotification(offer);
  await dependencies.markShown(offerId);
  return "shown";
}
