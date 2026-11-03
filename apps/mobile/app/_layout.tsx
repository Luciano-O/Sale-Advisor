import { Stack, router } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { Suspense, useEffect } from "react";
import { ActivityIndicator, Linking, View } from "react-native";

import { AppProvider, useApp } from "../src/app-context";
import { migrateDatabase } from "../src/migrations";
import { subscribeToNotifications } from "../src/notifications";
import { colors } from "../src/theme";

function NotificationRouter() {
  const { track, hideFromNotification } = useApp();
  useEffect(
    () =>
      subscribeToNotifications((action) => {
        if (action.kind === "hide") {
          void hideFromNotification(action.offerId, action.snapshot);
          return;
        }
        void track("notification_opened", { offerId: action.offerId });
        if (action.kind === "open-store") {
          void track("offer_clicked", { offerId: action.offerId });
          void Linking.openURL(action.url);
          return;
        }
        router.push({ pathname: "/offer/[id]", params: { id: action.offerId } });
      }),
    [hideFromNotification, track]
  );
  return null;
}

function Navigation() {
  const { preferences, preferencesReady } = useApp();
  // Choosing a screen before the saved preferences are read would flash the onboarding.
  if (!preferencesReady) return <LoadingDatabase />;
  return (
    <>
      <NotificationRouter />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}
      >
        <Stack.Protected guard={preferences.onboardingCompleted}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="offer/[id]" />
          <Stack.Screen name="seguindo/[subcategoria]" />
          <Stack.Screen name="ajustes/nao-mostrar" />
          <Stack.Screen name="ajustes/privacidade" />
        </Stack.Protected>
        <Stack.Protected guard={!preferences.onboardingCompleted}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Screen name="debug-notification" />
      </Stack>
    </>
  );
}

function Application() {
  return (
    <AppProvider>
      <StatusBar style="dark" />
      <Navigation />
    </AppProvider>
  );
}

export default function RootLayout() {
  return (
    <Suspense fallback={<LoadingDatabase />}>
      <SQLiteProvider databaseName="sale-advisor.db" onInit={migrateDatabase} useSuspense>
        <Application />
      </SQLiteProvider>
    </Suspense>
  );
}

export function LoadingDatabase() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.ground
      }}
    >
      <ActivityIndicator color={colors.cobalt} />
    </View>
  );
}
