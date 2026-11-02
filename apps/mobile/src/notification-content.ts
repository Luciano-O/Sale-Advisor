import { hiddenOfferSnapshot } from "./feed";
import { formatMoney, formatPercent } from "./format";
import { labelName, offerName } from "./labels";
import type { HiddenOfferSnapshot, MobileOffer, ScoreLabel } from "./types";
import { lowestComparison } from "./verdict";

export const OFFER_CATEGORY = "offer";
export const ACTION_OPEN_STORE = "open-store";
export const ACTION_HIDE = "hide";

/** The better the offer, the more the alert interrupts. Silencing a channel is up to Android. */
export const OFFER_CHANNELS = [
  { id: "offers-boa", name: "Ofertas boas", level: "low", sound: false, vibrate: false },
  {
    id: "offers-muito-boa",
    name: "Ofertas muito boas",
    level: "default",
    sound: true,
    vibrate: false
  },
  {
    id: "offers-excepcional",
    name: "Ofertas excepcionais",
    level: "high",
    sound: true,
    vibrate: true
  }
] as const;

export function channelForLabel(label: ScoreLabel): string {
  if (label === "excepcional") return "offers-excepcional";
  return label === "muito_boa" ? "offers-muito-boa" : "offers-boa";
}

function verdictSentence(label: ScoreLabel, discountPercent: number | null): string {
  const name = labelName(label);
  if (discountPercent === null) return `${name}.`;
  const rounded = Math.round(discountPercent);
  if (rounded === 0) return `${name}: no preço da mediana de 30 dias.`;
  const side = rounded > 0 ? "abaixo" : "acima";
  return `${name}: ${formatPercent(Math.abs(rounded))} ${side} da mediana de 30 dias.`;
}

/** The verdict comes first: it is the only sentence visible while the notification is closed. */
export function buildOfferNotification(offer: MobileOffer) {
  const body = [
    verdictSentence(offer.label, offer.history.discountVsMedianPercent),
    offer.history.lowest90dInCents === null
      ? null
      : lowestComparison(offer.effectivePriceCents, offer.history.lowest90dInCents),
    offer.coupon ? `Cupom ${offer.coupon}.` : null
  ]
    .filter((sentence) => sentence !== null)
    .join(" ");
  return {
    title: `${offerName(offer.product)} por ${formatMoney(offer.effectivePriceCents)}`,
    subtitle: offer.store.name,
    body,
    channelId: channelForLabel(offer.label),
    categoryIdentifier: OFFER_CATEGORY,
    // The actions may run with the app closed and offline, so they carry what they need.
    data: {
      offerId: offer.id,
      locallyPresented: true,
      url: offer.url,
      snapshot: hiddenOfferSnapshot(offer)
    }
  };
}

export type NotificationAction =
  | { kind: "open-detail"; offerId: string }
  | { kind: "open-store"; offerId: string; url: string }
  | { kind: "hide"; offerId: string; snapshot: HiddenOfferSnapshot | null };

function readSnapshot(value: unknown): HiddenOfferSnapshot | null {
  if (typeof value !== "object" || value === null) return null;
  const { name, storeName, priceCents } = value as Record<string, unknown>;
  return typeof name === "string" && typeof storeName === "string" && typeof priceCents === "number"
    ? { name, storeName, priceCents }
    : null;
}

/** A running app gets the data as an object; the background task gets it serialized. */
export function notificationResponseData(
  content: { data?: unknown; dataString?: unknown } | undefined
): Record<string, unknown> | null {
  if (typeof content?.data === "object" && content.data !== null)
    return content.data as Record<string, unknown>;
  if (typeof content?.dataString !== "string") return null;
  try {
    return JSON.parse(content.dataString) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** What to do with a response to a notification; null when it is not about an offer. */
export function notificationAction(
  actionIdentifier: string,
  data: Record<string, unknown> | null | undefined
): NotificationAction | null {
  const offerId = data?.offerId;
  if (typeof offerId !== "string") return null;
  if (actionIdentifier === ACTION_HIDE)
    return { kind: "hide", offerId, snapshot: readSnapshot(data?.snapshot) };
  if (actionIdentifier === ACTION_OPEN_STORE && typeof data?.url === "string")
    return { kind: "open-store", offerId, url: data.url };
  return { kind: "open-detail", offerId };
}
