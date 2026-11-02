import { describe, expect, it } from "vitest";

import {
  alertsPanelState,
  availableStores,
  blockedStoreRows,
  blockedStoresSummary,
  hiddenOfferRow,
  hiddenOffersSummary
} from "./settings";

const stores = [
  { name: "KaBuM!", domain: "kabum.com.br" },
  { name: "Pichau", domain: "pichau.com.br" },
  { name: "Terabyte", domain: "terabyteshop.com.br" }
];

describe("alertsPanelState", () => {
  const granted = { granted: true, canAskAgain: true };

  it("follows the choice while Android allows alerts", () => {
    expect(alertsPanelState(granted, true)).toBe("on");
    expect(alertsPanelState(granted, false)).toBe("off");
  });

  it("is blocked when Android will not ask again, whatever was chosen", () => {
    expect(alertsPanelState({ granted: false, canAskAgain: false }, true)).toBe("blocked");
    expect(alertsPanelState({ granted: false, canAskAgain: false }, false)).toBe("blocked");
  });

  it("is off while the app can still ask, so the switch can ask", () => {
    expect(alertsPanelState({ granted: false, canAskAgain: true }, true)).toBe("off");
    expect(alertsPanelState({ granted: false, canAskAgain: true }, false)).toBe("off");
  });
});

describe("hiddenOfferRow", () => {
  const now = new Date(2026, 9, 29, 12, 0);
  const hiddenAt = new Date(2026, 9, 27, 12, 0).toISOString();

  it("shows what the offer was when it was hidden", () => {
    expect(
      hiddenOfferRow(
        {
          id: "a",
          hiddenAt,
          snapshot: { name: "RTX 4060 8GB", storeName: "Pichau", priceCents: 174990 }
        },
        now
      )
    ).toEqual({
      id: "a",
      name: "RTX 4060 8GB",
      meta: "Pichau · R$ 1.749,90 · ocultada há 2 dias"
    });
  });

  it("still lists an offer hidden before snapshots existed", () => {
    expect(hiddenOfferRow({ id: "a", hiddenAt, snapshot: null }, now)).toEqual({
      id: "a",
      name: "Oferta ocultada",
      meta: "ocultada há 2 dias"
    });
  });
});

describe("hiddenOffersSummary", () => {
  const row = (name: string) => ({
    id: name,
    hiddenAt: "2026-10-27T12:00:00.000Z",
    snapshot: { name, storeName: "Loja", priceCents: 100 }
  });

  it("names the offers without listing them all", () => {
    expect(hiddenOffersSummary([])).toBe("Nenhuma");
    expect(hiddenOffersSummary([row("RTX 4060 8GB")])).toBe("RTX 4060 8GB");
    expect(hiddenOffersSummary([row("RTX 4060 8GB"), row("RX 7600 8GB")])).toBe(
      "RTX 4060 8GB e mais 1"
    );
  });
});

describe("blocked stores", () => {
  it("shows the store's name and domain, however it was saved", () => {
    expect(blockedStoreRows(["pichau.com.br", "KaBuM!"], stores)).toEqual([
      { key: "pichau.com.br", name: "Pichau", hint: "pichau.com.br" },
      { key: "KaBuM!", name: "KaBuM!", hint: "kabum.com.br" }
    ]);
  });

  it("keeps showing a block for a store no longer on the list", () => {
    expect(blockedStoreRows(["loja.example"], stores)).toEqual([
      { key: "loja.example", name: "loja.example", hint: "" }
    ]);
  });

  it("offers only stores not blocked yet, ignoring letter case", () => {
    expect(availableStores(stores, ["PICHAU.com.br", "kabum!"])).toEqual([
      { name: "Terabyte", domain: "terabyteshop.com.br" }
    ]);
  });

  it("summarizes the blocks", () => {
    expect(blockedStoresSummary([], stores)).toBe("Nenhuma");
    expect(blockedStoresSummary(["pichau.com.br"], stores)).toBe("Pichau");
    expect(blockedStoresSummary(["pichau.com.br", "kabum.com.br"], stores)).toBe("Pichau e mais 1");
  });
});
