import { describe, expect, it } from "vitest";

import {
  activeSubcategories,
  addSubcategory,
  followPendingWhole,
  followedSubcategories,
  migratePreferences,
  pendingSubcategories,
  preselectedChoices,
  removeSubcategory,
  setSubcategoryMode,
  skipOnboarding,
  stepAfterSubcategories,
  toggleSubcategory,
  toggleSubcategoryProduct
} from "./preferences";
import { DEFAULT_PREFERENCES, type LocalPreferences } from "./types";

const v1 = {
  followedCategories: ["GPU"],
  followedModels: [],
  blockedBrands: [],
  blockedStores: [],
  minimumLabel: "boa"
};

describe("migratePreferences", () => {
  it("starts a new installation before the onboarding", () => {
    expect(migratePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(DEFAULT_PREFERENCES).toMatchObject({
      version: 2,
      onboardingCompleted: false,
      followAll: false,
      subcategories: {},
      alertsEnabled: false,
      analyticsEnabled: true
    });
  });

  it("turns followed models into specific products of the GPU subcategory", () => {
    expect(
      migratePreferences({ ...v1, followedModels: ["RTX 5060", "RX 9070 XT"] }).subcategories
    ).toEqual({ GPU: { mode: "produtos", products: ["RTX 5060", "RX 9070 XT"] } });
  });

  it("turns no followed models into the whole GPU subcategory", () => {
    expect(migratePreferences(v1).subcategories).toEqual({
      GPU: { mode: "inteira", products: [] }
    });
  });

  it("does not send someone with saved preferences through the onboarding", () => {
    expect(migratePreferences(v1)).toMatchObject({
      version: 2,
      onboardingCompleted: true,
      followAll: false
    });
  });

  it("keeps blocked stores and brands, and the alerts this installation already had", () => {
    expect(
      migratePreferences({ ...v1, blockedBrands: ["NVIDIA"], blockedStores: ["loja.example"] })
    ).toMatchObject({
      blockedBrands: ["NVIDIA"],
      blockedStores: ["loja.example"],
      alertsEnabled: true,
      analyticsEnabled: true
    });
  });

  it("drops the minimum level, which the user no longer chooses", () => {
    expect(migratePreferences({ ...v1, minimumLabel: "excepcional" })).not.toHaveProperty(
      "minimumLabel"
    );
  });

  it("leaves current preferences as they are", () => {
    const current: LocalPreferences = {
      version: 2,
      onboardingCompleted: true,
      followAll: true,
      subcategories: { GPU: { mode: "inteira", products: ["RTX 5060"] } },
      blockedStores: ["loja.example"],
      blockedBrands: [],
      alertsEnabled: false,
      analyticsEnabled: false
    };
    expect(migratePreferences(current)).toEqual(current);
  });

  it("survives something that is not preferences", () => {
    expect(migratePreferences("nonsense")).toEqual(DEFAULT_PREFERENCES);
    expect(migratePreferences({ ...v1, followedModels: "RTX 5060" }).subcategories).toEqual({
      GPU: { mode: "inteira", products: [] }
    });
  });
});

describe("activeSubcategories", () => {
  it("lists each subcategory that has a catalog once", () => {
    expect(
      activeSubcategories([{ category: "GPU" }, { category: "GPU" }, { category: "CPU" }])
    ).toEqual(["GPU", "CPU"]);
  });

  it("falls back to GPU while the catalog is unavailable", () => {
    expect(activeSubcategories(null)).toEqual(["GPU"]);
    expect(activeSubcategories([])).toEqual(["GPU"]);
  });
});

describe("onboarding choices", () => {
  it("preselects the only active subcategory", () => {
    expect(preselectedChoices(["GPU"]).subcategories).toEqual({
      GPU: { mode: "produtos", products: [] }
    });
  });

  it("preselects nothing when there is a choice to make", () => {
    expect(preselectedChoices(["GPU", "CPU"]).subcategories).toEqual({});
  });

  it("selects and deselects a subcategory", () => {
    const selected = toggleSubcategory(DEFAULT_PREFERENCES, "GPU");
    expect(selected.subcategories).toEqual({ GPU: { mode: "produtos", products: [] } });
    expect(toggleSubcategory(selected, "GPU").subcategories).toEqual({});
  });

  it("skips the products step when following all hardware", () => {
    expect(stepAfterSubcategories({ ...DEFAULT_PREFERENCES, followAll: true })).toBe("alertas");
  });

  it("asks for products when following specific subcategories", () => {
    expect(stepAfterSubcategories(toggleSubcategory(DEFAULT_PREFERENCES, "GPU"))).toBe("produtos");
  });

  it("skipping the onboarding follows all hardware, without asking for alerts", () => {
    expect(skipOnboarding(DEFAULT_PREFERENCES)).toMatchObject({
      onboardingCompleted: true,
      followAll: true,
      alertsEnabled: false
    });
  });
});

describe("pendingSubcategories", () => {
  const choices = (subcategories: LocalPreferences["subcategories"]): LocalPreferences => ({
    ...DEFAULT_PREFERENCES,
    subcategories
  });

  it("flags a subcategory waiting for its first product", () => {
    expect(
      pendingSubcategories(
        choices({
          GPU: { mode: "produtos", products: [] },
          CPU: { mode: "produtos", products: ["Ryzen 7"] },
          SSD: { mode: "inteira", products: [] }
        })
      )
    ).toEqual(["GPU"]);
  });

  it("has nothing pending when following all hardware", () => {
    expect(
      pendingSubcategories({
        ...choices({ GPU: { mode: "produtos", products: [] } }),
        followAll: true
      })
    ).toEqual([]);
  });

  it("follows the pending subcategories whole, leaving the others alone", () => {
    expect(
      followPendingWhole(
        choices({
          GPU: { mode: "produtos", products: [] },
          CPU: { mode: "produtos", products: ["Ryzen 7"] }
        })
      ).subcategories
    ).toEqual({
      GPU: { mode: "inteira", products: [] },
      CPU: { mode: "produtos", products: ["Ryzen 7"] }
    });
  });
});

describe("editing what is followed", () => {
  const following = addSubcategory(DEFAULT_PREFERENCES, "GPU");

  it("adds a subcategory whole", () => {
    expect(following.subcategories).toEqual({ GPU: { mode: "inteira", products: [] } });
  });

  it("does not lose the products of a subcategory already followed", () => {
    const withProduct = toggleSubcategoryProduct(following, "GPU", "RTX 5060");
    expect(addSubcategory(withProduct, "GPU").subcategories.GPU?.products).toEqual(["RTX 5060"]);
  });

  it("keeps the products while following the whole subcategory, for coming back", () => {
    const specific = toggleSubcategoryProduct(
      setSubcategoryMode(following, "GPU", "produtos"),
      "GPU",
      "RTX 5060"
    );
    const whole = setSubcategoryMode(specific, "GPU", "inteira");
    expect(whole.subcategories.GPU).toEqual({ mode: "inteira", products: ["RTX 5060"] });
    expect(setSubcategoryMode(whole, "GPU", "produtos").subcategories.GPU).toEqual({
      mode: "produtos",
      products: ["RTX 5060"]
    });
  });

  it("adds and removes a product regardless of letter case", () => {
    const added = toggleSubcategoryProduct(following, "GPU", "RTX 5060");
    expect(added.subcategories.GPU?.products).toEqual(["RTX 5060"]);
    expect(toggleSubcategoryProduct(added, "GPU", "rtx 5060").subcategories.GPU?.products).toEqual(
      []
    );
  });

  it("stops following a subcategory", () => {
    expect(removeSubcategory(following, "GPU").subcategories).toEqual({});
  });

  it("does not change the preferences it receives", () => {
    removeSubcategory(following, "GPU");
    expect(following.subcategories).toHaveProperty("GPU");
  });
});

describe("followedSubcategories", () => {
  it("lists what is followed", () => {
    expect(followedSubcategories(addSubcategory(DEFAULT_PREFERENCES, "GPU"), ["CPU"])).toEqual([
      "GPU"
    ]);
  });

  it("is everything active when following all hardware", () => {
    expect(
      followedSubcategories({ ...DEFAULT_PREFERENCES, followAll: true }, ["GPU", "CPU"])
    ).toEqual(["GPU", "CPU"]);
  });
});
