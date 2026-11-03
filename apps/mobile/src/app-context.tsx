import Constants from "expo-constants";
import { useSQLiteContext } from "expo-sqlite";
import { AppState as NativeAppState } from "react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from "react";

import {
  fetchCatalog,
  fetchOfferPage,
  fetchStores,
  registerInstallation,
  sendEvents,
  updateBroadPreferences,
  updatePushTarget,
  type CatalogModel
} from "./api";
import { loadFeed, type FeedSource } from "./cache";
import { createMobileDatabase } from "./database";
import { flushPendingEvents, recordEvent } from "./events";
import { appendOfferPage } from "./feed";
import { filterOffers } from "./filters";
import { configureNotifications, currentPushToken, requestPushPermission } from "./notifications";
import type { PublicStore } from "./settings";
import { STARTER_OFFERS } from "./starter-offers";
import {
  DEFAULT_PREFERENCES,
  type AnonymousEventName,
  type HiddenOffer,
  type HiddenOfferSnapshot,
  type LocalPreferences,
  type MobileOffer,
  type OfferSort
} from "./types";

export type CatalogStatus = "loading" | "ready" | "failed";

export interface UndoNotice {
  message: string;
  undo(): void;
}

interface AppState {
  offers: MobileOffer[];
  /** Everything loaded, before the filters: the onboarding tests its choices against this. */
  feedOffers: MobileOffer[];
  preferences: LocalPreferences;
  /** False until the saved preferences are read; no screen can be chosen before that. */
  preferencesReady: boolean;
  catalog: CatalogModel[] | null;
  catalogStatus: CatalogStatus;
  reloadCatalog(): Promise<void>;
  /** The stores that can be blocked; null until the first list arrives. */
  stores: PublicStore[] | null;
  storesStatus: CatalogStatus;
  reloadStores(): Promise<void>;
  /** Turning alerts on asks Android first; false when that was refused. */
  setAlertsEnabled(value: boolean): Promise<boolean>;
  setAnalyticsEnabled(value: boolean): Promise<void>;
  /** Erases everything local, starts a new installation and goes back to the onboarding. */
  clearLocalData(): Promise<void>;
  /** Survives going back to the previous screen, which is where it is shown. */
  undoNotice: UndoNotice | null;
  showUndoNotice(notice: UndoNotice | null): void;
  /** Asks Android for permission and registers this device for alerts; false when refused. */
  enableAlerts(): Promise<boolean>;
  installationId: string | null;
  loading: boolean;
  offline: boolean;
  feedSource: FeedSource;
  error: string | null;
  /** When the list last came from the network; survives restarts. */
  lastUpdated: string | null;
  /** Offers found after this moment get the "Nova" mark; fixed during a session. */
  lastViewedAt: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  /** Grows with each page that arrives, even one whose offers are all filtered out. */
  loadedPages: number;
  sort: OfferSort;
  changeSort(value: OfferSort): void;
  refresh(): Promise<FeedSource>;
  loadMore(): Promise<void>;
  savePreferences(value: LocalPreferences): Promise<void>;
  hideOffer(offer: MobileOffer): Promise<void>;
  /** The last hidden offer, while it can still be undone. */
  lastHidden: MobileOffer | null;
  undoHide(): Promise<void>;
  dismissLastHidden(): void;
  hiddenOffers: HiddenOffer[];
  /** For the "Ocultar" action of an alert, where only its snapshot of the offer exists. */
  hideFromNotification(id: string, snapshot: HiddenOfferSnapshot | null): Promise<void>;
  unhideOffer(id: string): Promise<void>;
  restoreHidden(offer: HiddenOffer): Promise<void>;
  track(
    name: AnonymousEventName,
    payload?: Record<string, string | number | boolean | null>
  ): Promise<void>;
}

const Context = createContext<AppState | null>(null);

export function AppProvider({ children }: PropsWithChildren) {
  const sqlite = useSQLiteContext();
  const database = useMemo(() => createMobileDatabase(sqlite), [sqlite]);
  const [allOffers, setAllOffers] = useState<MobileOffer[]>([]);
  const [hiddenOffers, setHiddenOffers] = useState<HiddenOffer[]>([]);
  const hiddenIds = useMemo(() => new Set(hiddenOffers.map(({ id }) => id)), [hiddenOffers]);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  // For callbacks that must not change identity whenever a preference changes.
  const preferencesRef = useRef(DEFAULT_PREFERENCES);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [catalog, setCatalog] = useState<CatalogModel[] | null>(null);
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>("loading");
  const [undoNotice, showUndoNotice] = useState<UndoNotice | null>(null);
  const [stores, setStores] = useState<PublicStore[] | null>(null);
  const [storesStatus, setStoresStatus] = useState<CatalogStatus>("loading");
  const [installationId, setInstallationId] = useState<string | null>(null);
  const installationIdRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [feedSource, setFeedSource] = useState<FeedSource>("network");
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [lastViewedAt, setLastViewedAt] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadedPages, setLoadedPages] = useState(0);
  const [sort, setSort] = useState<OfferSort>("recent");
  const [lastHidden, setLastHidden] = useState<MobileOffer | null>(null);
  const sortRef = useRef<OfferSort>("recent");
  // A response that arrives after the list was reloaded (or reordered) belongs to the old list.
  const feedGenerationRef = useRef(0);
  const nextCursorRef = useRef<string | null>(null);
  const loadingMoreRef = useRef(false);

  const track = useCallback(
    async (
      name: AnonymousEventName,
      payload?: Record<string, string | number | boolean | null>
    ) => {
      const id = installationIdRef.current ?? (await database.ensureInstallation());
      const recorded = await recordEvent(preferencesRef.current.analyticsEnabled, database, {
        installationId: id,
        name,
        occurredAt: new Date().toISOString(),
        ...(payload ? { payload } : {})
      });
      if (!recorded) return;
      try {
        await flushPendingEvents(database.pendingEvents, sendEvents);
      } catch {
        // The queue intentionally remains persisted for the next successful refresh.
      }
    },
    [database]
  );

  const refresh = useCallback(async () => {
    const generation = ++feedGenerationRef.current;
    setLoading(true);
    nextCursorRef.current = null;
    let nextCursor: string | null = null;
    const result = await loadFeed(
      database.offerCache,
      async () => {
        const page = await fetchOfferPage(null, sortRef.current);
        nextCursor = page.nextCursor;
        return page.offers;
      },
      STARTER_OFFERS
    );
    if (generation !== feedGenerationRef.current) return result.source;
    nextCursorRef.current = nextCursor;
    setHasMore(result.source === "network" && nextCursor !== null);
    setAllOffers(result.offers);
    setOffline(result.source === "cache");
    setFeedSource(result.source);
    setError(result.error);
    if (result.source === "network") {
      const refreshedAt = new Date().toISOString();
      setLastUpdated(refreshedAt);
      void database.setAppState("feed_refreshed_at", refreshedAt);
    }
    setLoadedPages((pages) => pages + 1);
    setLoading(false);
    await track("feed_refreshed", { source: result.source });
    return result.source;
  }, [database, track]);

  const changeSort = useCallback(
    (value: OfferSort) => {
      if (value === sortRef.current) return;
      sortRef.current = value;
      setSort(value);
      void refresh();
    },
    [refresh]
  );

  const loadMore = useCallback(async () => {
    const cursor = nextCursorRef.current;
    if (!cursor || loadingMoreRef.current) return;
    const generation = feedGenerationRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchOfferPage(cursor, sortRef.current);
      if (generation !== feedGenerationRef.current) return;
      nextCursorRef.current = page.nextCursor;
      setHasMore(page.nextCursor !== null);
      setAllOffers((current) => {
        const merged = appendOfferPage(current, page.offers);
        void database.offerCache.replace(merged);
        return merged;
      });
      setLoadedPages((pages) => pages + 1);
    } catch {
      // The current list stays usable; reaching the end of the list retries.
      if (generation === feedGenerationRef.current) setOffline(true);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [database.offerCache]);

  const reloadCatalog = useCallback(async () => {
    setCatalogStatus("loading");
    try {
      const items = await fetchCatalog();
      setCatalog(items);
      setCatalogStatus("ready");
      await database.setAppState("catalog", JSON.stringify(items));
    } catch {
      // A catalog saved earlier keeps working offline; only a first run has nothing to show.
      setCatalogStatus("failed");
    }
  }, [database]);

  const reloadStores = useCallback(async () => {
    setStoresStatus("loading");
    try {
      const items = await fetchStores();
      setStores(items);
      setStoresStatus("ready");
      await database.setAppState("stores", JSON.stringify(items));
    } catch {
      setStoresStatus("failed");
    }
  }, [database]);

  const reloadHidden = useCallback(async () => {
    setHiddenOffers(await database.listHidden());
  }, [database]);

  // "Ocultar" on an alert runs without the app, which finds out when it comes back.
  useEffect(() => {
    const subscription = NativeAppState.addEventListener("change", (state) => {
      if (state === "active") void reloadHidden();
    });
    return () => subscription.remove();
  }, [reloadHidden]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [id, savedPreferences, savedHidden, viewedAt, refreshedAt, savedCatalog, savedStores] =
        await Promise.all([
          database.ensureInstallation(),
          database.getPreferences(),
          database.listHidden(),
          database.getAppState("feed_last_viewed_at"),
          database.getAppState("feed_refreshed_at"),
          database.getAppState("catalog"),
          database.getAppState("stores")
        ]);
      if (!active) return;
      setInstallationId(id);
      installationIdRef.current = id;
      setPreferences(savedPreferences);
      preferencesRef.current = savedPreferences;
      setPreferencesReady(true);
      setHiddenOffers(savedHidden);
      if (savedCatalog) setCatalog(JSON.parse(savedCatalog) as CatalogModel[]);
      if (savedStores) setStores(JSON.parse(savedStores) as PublicStore[]);
      void reloadCatalog();
      void reloadStores();
      setLastViewedAt(viewedAt);
      setLastUpdated(refreshedAt);
      // The list appears at once; registering and fetching can take long on a bad connection.
      const cachedOffers = await database.offerCache.read();
      if (active && cachedOffers.length > 0) setAllOffers(cachedOffers);
      await recordEvent(savedPreferences.analyticsEnabled, database, {
        installationId: id,
        name: "app_opened",
        occurredAt: new Date().toISOString()
      });
      try {
        await registerInstallation(id, Constants.expoConfig?.version ?? "0.1.0");
        await updateBroadPreferences(id);
        await configureNotifications();
        await updatePushTarget(
          id,
          savedPreferences.alertsEnabled ? await currentPushToken() : null
        );
        await flushPendingEvents(database.pendingEvents, sendEvents);
      } catch {
        // Startup remains offline-first; registration and events retry later.
      }
      // Offers stop being new only once a real list has been shown, not after an offline start.
      if ((await refresh()) === "network")
        await database.setAppState("feed_last_viewed_at", new Date().toISOString());
    })();
    return () => {
      active = false;
    };
  }, [database, refresh, reloadCatalog, reloadStores]);

  const save = useCallback(
    async (value: LocalPreferences) => {
      await database.savePreferences(value);
      setPreferences(value);
      preferencesRef.current = value;
    },
    [database]
  );

  const enableAlerts = useCallback(async () => {
    if (!(await requestPushPermission())) return false;
    const id = installationIdRef.current ?? (await database.ensureInstallation());
    try {
      await configureNotifications();
      await updatePushTarget(id, await currentPushToken());
    } catch {
      // Permission is what the user decided; registering retries at the next start.
    }
    return true;
  }, [database]);

  const setAlertsEnabled = useCallback(
    async (value: boolean) => {
      if (value && !(await enableAlerts())) return false;
      await save({ ...preferencesRef.current, alertsEnabled: value });
      if (!value && installationIdRef.current)
        try {
          await updatePushTarget(installationIdRef.current, null);
        } catch {
          // The filter on the device already silences alerts; the next start tells the server.
        }
      return true;
    },
    [enableAlerts, save]
  );

  const setAnalyticsEnabled = useCallback(
    async (value: boolean) => {
      await save({ ...preferencesRef.current, analyticsEnabled: value });
      if (!value) await database.clearPendingEvents();
    },
    [database, save]
  );

  const clearLocalData = useCallback(async () => {
    // The old record stays on the server without anything pointing to it, so it must stop
    // receiving alerts while there is a connection to say so.
    if (installationIdRef.current)
      try {
        await updatePushTarget(installationIdRef.current, null);
      } catch {
        // Without a connection the old record keeps the token; the device filters what arrives.
      }
    await database.clearAll();
    const id = await database.ensureInstallation();
    installationIdRef.current = id;
    setInstallationId(id);
    preferencesRef.current = DEFAULT_PREFERENCES;
    setPreferences(DEFAULT_PREFERENCES);
    setHiddenOffers([]);
    setAllOffers([]);
    setLastHidden(null);
    showUndoNotice(null);
    setLastViewedAt(null);
    setLastUpdated(null);
    try {
      await registerInstallation(id, Constants.expoConfig?.version ?? "0.1.0");
      await updateBroadPreferences(id);
    } catch {
      // The next start registers it again.
    }
    void reloadCatalog();
    void reloadStores();
    await refresh();
  }, [database, refresh, reloadCatalog, reloadStores]);

  const hideOffer = useCallback(
    async (offer: MobileOffer) => {
      await database.hide(offer);
      await reloadHidden();
      setLastHidden(offer);
      await track("product_hidden", { offerId: offer.id });
    },
    [database, reloadHidden, track]
  );

  const hideFromNotification = useCallback(
    async (id: string, snapshot: HiddenOfferSnapshot | null) => {
      await database.hideSnapshot(id, snapshot);
      await reloadHidden();
      await track("product_hidden", { offerId: id });
    },
    [database, reloadHidden, track]
  );

  const unhideOffer = useCallback(
    async (id: string) => {
      await database.unhide(id);
      await reloadHidden();
    },
    [database, reloadHidden]
  );

  const restoreHidden = useCallback(
    async ({ id, snapshot, hiddenAt }: HiddenOffer) => {
      await database.hideSnapshot(id, snapshot, hiddenAt);
      await reloadHidden();
    },
    [database, reloadHidden]
  );

  const undoHide = useCallback(async () => {
    if (!lastHidden) return;
    setLastHidden(null);
    await unhideOffer(lastHidden.id);
  }, [lastHidden, unhideOffer]);

  const dismissLastHidden = useCallback(() => setLastHidden(null), []);

  const value = useMemo<AppState>(
    () => ({
      offers: filterOffers(allOffers, preferences, hiddenIds, sort),
      feedOffers: allOffers,
      preferences,
      preferencesReady,
      catalog,
      catalogStatus,
      reloadCatalog,
      stores,
      storesStatus,
      reloadStores,
      setAlertsEnabled,
      setAnalyticsEnabled,
      clearLocalData,
      undoNotice,
      showUndoNotice,
      enableAlerts,
      installationId,
      loading,
      offline,
      feedSource,
      error,
      lastUpdated,
      lastViewedAt,
      hasMore,
      loadingMore,
      loadedPages,
      sort,
      changeSort,
      refresh,
      loadMore,
      savePreferences: save,
      hideOffer,
      lastHidden,
      undoHide,
      dismissLastHidden,
      hiddenOffers,
      hideFromNotification,
      unhideOffer,
      restoreHidden,
      track
    }),
    [
      allOffers,
      preferences,
      preferencesReady,
      catalog,
      catalogStatus,
      reloadCatalog,
      stores,
      storesStatus,
      reloadStores,
      setAlertsEnabled,
      setAnalyticsEnabled,
      clearLocalData,
      undoNotice,
      enableAlerts,
      hiddenIds,
      hiddenOffers,
      hideFromNotification,
      unhideOffer,
      restoreHidden,
      installationId,
      loading,
      offline,
      feedSource,
      error,
      lastUpdated,
      lastViewedAt,
      hasMore,
      loadingMore,
      loadedPages,
      sort,
      changeSort,
      refresh,
      loadMore,
      save,
      hideOffer,
      lastHidden,
      undoHide,
      dismissLastHidden,
      track
    ]
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}
