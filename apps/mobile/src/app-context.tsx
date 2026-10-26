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
  fetchOfferPage,
  registerInstallation,
  sendEvents,
  updateBroadPreferences,
  updatePushTarget
} from "./api";
import { loadFeed, type FeedSource } from "./cache";
import { createMobileDatabase } from "./database";
import { flushPendingEvents } from "./events";
import { appendOfferPage } from "./feed";
import { filterOffers } from "./filters";
import { configureNotificationChannel, requestNativePushToken } from "./notifications";
import { STARTER_OFFERS } from "./starter-offers";
import {
  DEFAULT_PREFERENCES,
  type AnonymousEventName,
  type LocalPreferences,
  type MobileOffer
} from "./types";

interface AppState {
  offers: MobileOffer[];
  preferences: LocalPreferences;
  installationId: string | null;
  loading: boolean;
  offline: boolean;
  feedSource: FeedSource;
  error: string | null;
  lastUpdated: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  refresh(): Promise<void>;
  loadMore(): Promise<void>;
  savePreferences(value: LocalPreferences): Promise<void>;
  hideOffer(id: string): Promise<void>;
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
  const [installationId, setInstallationId] = useState<string | null>(null);
  const installationIdRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [feedSource, setFeedSource] = useState<FeedSource>("network");
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
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
    setLoading(true);
    nextCursorRef.current = null;
    const result = await loadFeed(
      database.offerCache,
      async () => {
        const page = await fetchOfferPage(null);
        nextCursorRef.current = page.nextCursor;
        return page.offers;
      },
      STARTER_OFFERS
    );
    setHasMore(result.source === "network" && nextCursorRef.current !== null);
    setAllOffers(result.offers);
    setOffline(result.source === "cache");
    setFeedSource(result.source);
    setError(result.error);
    setLastUpdated(new Date().toISOString());
    setLoading(false);
    await track("feed_refreshed", { source: result.source });
  }, [database.offerCache, track]);

  const loadMore = useCallback(async () => {
    const cursor = nextCursorRef.current;
    if (!cursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchOfferPage(cursor);
      nextCursorRef.current = page.nextCursor;
      setHasMore(page.nextCursor !== null);
      setAllOffers((current) => {
        const merged = appendOfferPage(current, page.offers);
        void database.offerCache.replace(merged);
        return merged;
      });
    } catch {
      // The current list stays usable; reaching the end of the list retries.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [database.offerCache]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [id, savedPreferences, savedHiddenIds] = await Promise.all([
        database.ensureInstallation(),
        database.getPreferences(),
        database.getHiddenIds()
      ]);
      if (!active) return;
      setInstallationId(id);
      installationIdRef.current = id;
      setPreferences(savedPreferences);
      setHiddenIds(savedHiddenIds);
      await database.enqueueEvent({
        installationId: id,
        name: "app_opened",
        occurredAt: new Date().toISOString()
      });
      try {
        await registerInstallation(id, Constants.expoConfig?.version ?? "0.1.0");
        await updateBroadPreferences(id, savedPreferences.minimumLabel);
        await configureNotificationChannel();
        await updatePushTarget(id, await requestNativePushToken());
        await flushPendingEvents(database.pendingEvents, sendEvents);
      } catch {
        // Startup remains offline-first; registration and events retry later.
      }
      await refresh();
    })();
    return () => {
      active = false;
    };
  }, [database, refresh]);

  const save = useCallback(
    async (value: LocalPreferences) => {
      await database.savePreferences(value);
      setPreferences(value);
      if (installationId)
        try {
          await updateBroadPreferences(installationId, value.minimumLabel);
        } catch {
          // Fine preferences are safely local and broad sync can retry later.
        }
    },
    [database, installationId]
  );

  const hideOffer = useCallback(
    async (id: string) => {
      await database.hide(id);
      setHiddenIds((current) => new Set([...current, id]));
      await track("product_hidden", { offerId: id });
    },
    [database, track]
  );

  const value = useMemo<AppState>(
    () => ({
      offers: filterOffers(allOffers, preferences, hiddenIds),
      preferences,
      installationId,
      loading,
      offline,
      feedSource,
      error,
      lastUpdated,
      hasMore,
      loadingMore,
      refresh,
      loadMore,
      savePreferences: save,
      hideOffer,
      track
    }),
    [
      allOffers,
      preferences,
      hiddenIds,
      installationId,
      loading,
      offline,
      feedSource,
      error,
      lastUpdated,
      hasMore,
      loadingMore,
      refresh,
      loadMore,
      save,
      hideOffer,
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
