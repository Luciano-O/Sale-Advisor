import { describe, expect, it } from "vitest";

import {
  OFFER_CATEGORY,
  OFFER_CHANNELS,
  buildOfferNotification,
  channelForLabel,
  notificationAction,
  notificationResponseData
} from "./notification-content";
import type { MobileOffer } from "./types";

const offer: MobileOffer = {
  id: "offer-1",
  productId: "product-1",
  product: { category: "GPU", vendor: "NVIDIA", model: "RTX 5060", vramGb: 8 },
  store: { name: "KaBuM!", domain: "kabum.com.br" },
  effectivePriceCents: 189990,
  label: "muito_boa",
  qualityScore: 86,
  scoreSummary: "",
  mentionCount: 3,
  firstSeenAt: "2026-10-29T12:00:00.000Z",
  lastSeenAt: "2026-10-29T12:00:00.000Z",
  status: "active",
  history: { median30dInCents: 213900, lowest90dInCents: 184900, discountVsMedianPercent: 11.2 },
  coupon: null,
  url: "https://kabum.com.br/produto/1"
};

describe("buildOfferNotification", () => {
  it("titles the alert with the product and the price", () => {
    expect(buildOfferNotification(offer).title).toBe("RTX 5060 8GB por R$ 1.899,90");
  });

  it("shows the store in the header, next to the app name and the time", () => {
    expect(buildOfferNotification(offer).subtitle).toBe("KaBuM!");
  });

  it("opens the text with the verdict, the only sentence visible when collapsed", () => {
    expect(buildOfferNotification(offer).body).toBe(
      "Muito boa: 11% abaixo da mediana de 30 dias. R$ 51 acima da mínima de 90 dias."
    );
  });

  it("adds the coupon at the end", () => {
    expect(buildOfferNotification({ ...offer, coupon: "PLACA5" }).body).toBe(
      "Muito boa: 11% abaixo da mediana de 30 dias. R$ 51 acima da mínima de 90 dias. Cupom PLACA5."
    );
  });

  it("announces the lowest price of the last 90 days", () => {
    const lowest = { ...offer, effectivePriceCents: 184900 };
    expect(buildOfferNotification(lowest).body).toBe(
      "Muito boa: 11% abaixo da mediana de 30 dias. Menor preço dos últimos 90 dias."
    );
  });

  it("gives just the label when there is no history", () => {
    const noHistory = {
      ...offer,
      coupon: "PLACA5",
      history: { median30dInCents: null, lowest90dInCents: null, discountVsMedianPercent: null }
    };
    expect(buildOfferNotification(noHistory).body).toBe("Muito boa. Cupom PLACA5.");
  });

  it("says so when the price is not below the median", () => {
    const above = { ...offer, history: { ...offer.history, discountVsMedianPercent: -4.2 } };
    expect(buildOfferNotification(above).body).toContain(
      "Muito boa: 4% acima da mediana de 30 dias."
    );
    const same = { ...offer, history: { ...offer.history, discountVsMedianPercent: 0.2 } };
    expect(buildOfferNotification(same).body).toContain(
      "Muito boa: no preço da mediana de 30 dias."
    );
  });

  it("carries what the actions need, since they run without fetching anything", () => {
    expect(buildOfferNotification(offer).data).toEqual({
      offerId: "offer-1",
      locallyPresented: true,
      url: "https://kabum.com.br/produto/1",
      snapshot: { name: "RTX 5060 8GB", storeName: "KaBuM!", priceCents: 189990 }
    });
  });

  it("uses the channel of the label and offers the actions", () => {
    const notification = buildOfferNotification({ ...offer, label: "excepcional" });
    expect(notification.channelId).toBe("offers-excepcional");
    expect(notification.categoryIdentifier).toBe(OFFER_CATEGORY);
  });
});

describe("channels", () => {
  it("has one channel per label a user can receive", () => {
    expect(OFFER_CHANNELS.map(({ id, name }) => [id, name])).toEqual([
      ["offers-boa", "Ofertas boas"],
      ["offers-muito-boa", "Ofertas muito boas"],
      ["offers-excepcional", "Ofertas excepcionais"]
    ]);
  });

  it("interrupts more the better the offer is", () => {
    expect(OFFER_CHANNELS.map(({ level }) => level)).toEqual(["low", "default", "high"]);
    expect(OFFER_CHANNELS.map(({ sound }) => sound)).toEqual([false, true, true]);
    expect(OFFER_CHANNELS.map(({ vibrate }) => vibrate)).toEqual([false, false, true]);
  });

  it("maps each label to its channel", () => {
    expect(channelForLabel("boa")).toBe("offers-boa");
    expect(channelForLabel("muito_boa")).toBe("offers-muito-boa");
    expect(channelForLabel("excepcional")).toBe("offers-excepcional");
    expect(channelForLabel("normal")).toBe("offers-boa");
  });
});

describe("notificationResponseData", () => {
  it("reads the data as the listeners of a running app receive it", () => {
    expect(notificationResponseData({ data: { offerId: "offer-1" } })).toEqual({
      offerId: "offer-1"
    });
  });

  it("reads the data as the background task receives it, serialized", () => {
    expect(notificationResponseData({ dataString: '{"offerId":"offer-1"}' })).toEqual({
      offerId: "offer-1"
    });
  });

  it("has nothing to read in a broken or empty notification", () => {
    expect(notificationResponseData({ dataString: "not json" })).toBeNull();
    expect(notificationResponseData({})).toBeNull();
    expect(notificationResponseData(undefined)).toBeNull();
  });
});

describe("notificationAction", () => {
  const data = buildOfferNotification(offer).data;

  it("opens the detail on a plain tap", () => {
    expect(notificationAction("expo.modules.notifications.actions.DEFAULT", data)).toEqual({
      kind: "open-detail",
      offerId: "offer-1"
    });
  });

  it("opens the store when the action has a link", () => {
    expect(notificationAction("open-store", data)).toEqual({
      kind: "open-store",
      offerId: "offer-1",
      url: "https://kabum.com.br/produto/1"
    });
  });

  it("falls back to the detail when the offer has no link", () => {
    expect(notificationAction("open-store", { ...data, url: null })).toEqual({
      kind: "open-detail",
      offerId: "offer-1"
    });
  });

  it("hides with the snapshot for the hidden offers list", () => {
    expect(notificationAction("hide", data)).toEqual({
      kind: "hide",
      offerId: "offer-1",
      snapshot: { name: "RTX 5060 8GB", storeName: "KaBuM!", priceCents: 189990 }
    });
  });

  it("still hides a notification without a readable snapshot", () => {
    expect(notificationAction("hide", { offerId: "offer-1" })).toEqual({
      kind: "hide",
      offerId: "offer-1",
      snapshot: null
    });
  });

  it("ignores a notification that is not an offer", () => {
    expect(notificationAction("hide", {})).toBeNull();
    expect(notificationAction("open-store", null)).toBeNull();
  });
});
