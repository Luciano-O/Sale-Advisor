import { toggleModel } from "./selection";
import {
  DEFAULT_PREFERENCES,
  type LocalPreferences,
  type SubcategoryFollow,
  type SubcategoryMode
} from "./types";

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/**
 * Preferences are converted when read, so nothing has to run at install time. Version 1 had
 * followed models and a minimum level; the level is gone because the threshold is now fixed.
 */
export function migratePreferences(raw: unknown): LocalPreferences {
  if (typeof raw !== "object" || raw === null) return DEFAULT_PREFERENCES;
  const saved = raw as Record<string, unknown>;
  if (saved.version === 2) return { ...DEFAULT_PREFERENCES, ...saved } as LocalPreferences;
  const followedModels = stringList(saved.followedModels);
  return {
    ...DEFAULT_PREFERENCES,
    onboardingCompleted: true,
    subcategories: {
      GPU:
        followedModels.length > 0
          ? { mode: "produtos", products: followedModels }
          : { mode: "inteira", products: [] }
    },
    blockedBrands: stringList(saved.blockedBrands),
    blockedStores: stringList(saved.blockedStores),
    alertsEnabled: true
  };
}

// Only GPUs have a catalog today, so that is what the app can offer when the catalog is unavailable.
const FALLBACK_SUBCATEGORIES = ["GPU"];

export function activeSubcategories(catalog: ReadonlyArray<{ category: string }> | null): string[] {
  const active = [...new Set((catalog ?? []).map(({ category }) => category))];
  return active.length > 0 ? active : FALLBACK_SUBCATEGORIES;
}

export function followedSubcategories(
  preferences: LocalPreferences,
  active: readonly string[]
): string[] {
  return preferences.followAll ? [...active] : Object.keys(preferences.subcategories);
}

function withSubcategory(
  preferences: LocalPreferences,
  key: string,
  follow: SubcategoryFollow
): LocalPreferences {
  return { ...preferences, subcategories: { ...preferences.subcategories, [key]: follow } };
}

export function removeSubcategory(preferences: LocalPreferences, key: string): LocalPreferences {
  const subcategories = { ...preferences.subcategories };
  delete subcategories[key];
  return { ...preferences, subcategories };
}

/** A subcategory added from Seguindo enters whole; products are chosen afterwards. */
export function addSubcategory(preferences: LocalPreferences, key: string): LocalPreferences {
  if (preferences.subcategories[key]) return preferences;
  return withSubcategory(preferences, key, { mode: "inteira", products: [] });
}

/** Products stay saved while following the whole subcategory, for coming back to them. */
export function setSubcategoryMode(
  preferences: LocalPreferences,
  key: string,
  mode: SubcategoryMode
): LocalPreferences {
  return withSubcategory(preferences, key, {
    mode,
    products: preferences.subcategories[key]?.products ?? []
  });
}

export function toggleSubcategoryProduct(
  preferences: LocalPreferences,
  key: string,
  model: string
): LocalPreferences {
  const current = preferences.subcategories[key];
  return withSubcategory(preferences, key, {
    mode: current?.mode ?? "produtos",
    products: toggleModel(current?.products ?? [], model)
  });
}

/** In the onboarding a chosen subcategory goes on to ask for its products. */
export function toggleSubcategory(preferences: LocalPreferences, key: string): LocalPreferences {
  return preferences.subcategories[key]
    ? removeSubcategory(preferences, key)
    : withSubcategory(preferences, key, { mode: "produtos", products: [] });
}

/** With a single active subcategory there is nothing to choose, so it comes selected. */
export function preselectedChoices(active: readonly string[]): LocalPreferences {
  const [only] = active;
  return active.length === 1 && only
    ? toggleSubcategory(DEFAULT_PREFERENCES, only)
    : DEFAULT_PREFERENCES;
}

export function stepAfterSubcategories(preferences: LocalPreferences): "produtos" | "alertas" {
  return preferences.followAll ? "alertas" : "produtos";
}

/** Subcategories still waiting for a first product; the onboarding cannot continue with them. */
export function pendingSubcategories(preferences: LocalPreferences): string[] {
  if (preferences.followAll) return [];
  return Object.entries(preferences.subcategories)
    .filter(([, { mode, products }]) => mode === "produtos" && products.length === 0)
    .map(([key]) => key);
}

export function followPendingWhole(preferences: LocalPreferences): LocalPreferences {
  return pendingSubcategories(preferences).reduce(
    (current, key) => setSubcategoryMode(current, key, "inteira"),
    preferences
  );
}

/** Whoever skips still sees every good offer, and decides about alerts later. */
export function skipOnboarding(preferences: LocalPreferences): LocalPreferences {
  return { ...preferences, onboardingCompleted: true, followAll: true };
}
