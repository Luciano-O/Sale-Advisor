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
  fetchOffers,
  registerInstallation,
  sendEvents,
  updateBroadPreferences,
  updatePushTarget
} from "./api";
import { loadFeed } from "./cache";
import { createMobileDatabase } from "./database";
import { flushPendingEvents } from "./events";
import { filterOffers } from "./filters";
import { configureNotificationChannel, requestNativePushToken } from "./notifications";
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
  error: string | null;
  lastUpdated: string | null;
  refresh(): Promise<void>;
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
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

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
    const result = await loadFeed(database.offerCache, fetchOffers);
    setAllOffers(result.offers);
    setOffline(result.source === "cache");
    setError(result.error);
    setLastUpdated(new Date().toISOString());
    setLoading(false);
    await track("feed_refreshed", { source: result.source });
  }, [database.offerCache, track]);

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
      error,
      lastUpdated,
      refresh,
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
      error,
      lastUpdated,
      refresh,
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
