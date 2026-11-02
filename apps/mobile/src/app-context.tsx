import Constants from "expo-constants";
import { useSQLiteContext } from "expo-sqlite";
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
  registerInstallation,
  sendEvents,
  updateBroadPreferences,
  updatePushTarget,
  type CatalogModel
} from "./api";
import { loadFeed, type FeedSource } from "./cache";
import { createMobileDatabase } from "./database";
import { flushPendingEvents } from "./events";
import { appendOfferPage } from "./feed";
import { filterOffers } from "./filters";
import {
  configureNotificationChannel,
  currentPushToken,
  requestPushPermission
} from "./notifications";
import { STARTER_OFFERS } from "./starter-offers";
import {
  DEFAULT_PREFERENCES,
  type AnonymousEventName,
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
  hiddenCount: number;
  showHiddenOffers(): Promise<void>;
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
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [catalog, setCatalog] = useState<CatalogModel[] | null>(null);
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>("loading");
  const [undoNotice, showUndoNotice] = useState<UndoNotice | null>(null);
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
      await database.enqueueEvent({
        installationId: id,
        name,
        occurredAt: new Date().toISOString(),
        ...(payload ? { payload } : {})
      });
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

  useEffect(() => {
    let active = true;
    void (async () => {
      const [id, savedPreferences, savedHiddenIds, viewedAt, refreshedAt, savedCatalog] =
        await Promise.all([
          database.ensureInstallation(),
          database.getPreferences(),
          database.getHiddenIds(),
          database.getAppState("feed_last_viewed_at"),
          database.getAppState("feed_refreshed_at"),
          database.getAppState("catalog")
        ]);
      if (!active) return;
      setInstallationId(id);
      installationIdRef.current = id;
      setPreferences(savedPreferences);
      setPreferencesReady(true);
      setHiddenIds(savedHiddenIds);
      if (savedCatalog) setCatalog(JSON.parse(savedCatalog) as CatalogModel[]);
      void reloadCatalog();
      setLastViewedAt(viewedAt);
      setLastUpdated(refreshedAt);
      // The list appears at once; registering and fetching can take long on a bad connection.
      const cachedOffers = await database.offerCache.read();
      if (active && cachedOffers.length > 0) setAllOffers(cachedOffers);
      await database.enqueueEvent({
        installationId: id,
        name: "app_opened",
        occurredAt: new Date().toISOString()
      });
      try {
        await registerInstallation(id, Constants.expoConfig?.version ?? "0.1.0");
        await updateBroadPreferences(id);
        await configureNotificationChannel();
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
  }, [database, refresh, reloadCatalog]);

  const save = useCallback(
    async (value: LocalPreferences) => {
      await database.savePreferences(value);
      setPreferences(value);
    },
    [database]
  );

  const enableAlerts = useCallback(async () => {
    if (!(await requestPushPermission())) return false;
    const id = installationIdRef.current ?? (await database.ensureInstallation());
    try {
      await configureNotificationChannel();
      await updatePushTarget(id, await currentPushToken());
    } catch {
      // Permission is what the user decided; registering retries at the next start.
    }
    return true;
  }, [database]);

  const hideOffer = useCallback(
    async (offer: MobileOffer) => {
      await database.hide(offer);
      setHiddenIds((current) => new Set([...current, offer.id]));
      setLastHidden(offer);
      await track("product_hidden", { offerId: offer.id });
    },
    [database, track]
  );

  const undoHide = useCallback(async () => {
    if (!lastHidden) return;
    setLastHidden(null);
    await database.unhide(lastHidden.id);
    setHiddenIds((current) => new Set([...current].filter((id) => id !== lastHidden.id)));
  }, [database, lastHidden]);

  const dismissLastHidden = useCallback(() => setLastHidden(null), []);

  const showHiddenOffers = useCallback(async () => {
    await database.unhideAll();
    setHiddenIds(new Set());
  }, [database]);

  const value = useMemo<AppState>(
    () => ({
      offers: filterOffers(allOffers, preferences, hiddenIds, sort),
      feedOffers: allOffers,
      preferences,
      preferencesReady,
      catalog,
      catalogStatus,
      reloadCatalog,
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
      hiddenCount: hiddenIds.size,
      showHiddenOffers,
      track
    }),
    [
      allOffers,
      preferences,
      preferencesReady,
      catalog,
      catalogStatus,
      reloadCatalog,
      undoNotice,
      enableAlerts,
      hiddenIds,
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
      showHiddenOffers,
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
