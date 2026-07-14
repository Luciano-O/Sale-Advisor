import { Stack, router } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { Suspense, useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { AppProvider } from "../src/app-context";
import "../src/background-notifications";
import { migrateDatabase } from "../src/migrations";
import { subscribeToNotifications } from "../src/notifications";
import { colors } from "../src/theme";

function Application() {
  useEffect(
    () =>
      subscribeToNotifications((offerId) =>
        router.push({ pathname: "/offer/[id]", params: { id: offerId } })
      ),
    []
  );
  return (
    <AppProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
          headerShadowVisible: false
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="offer/[id]" options={{ title: "Detalhes da oferta" }} />
        <Stack.Screen name="preferences" options={{ title: "Preferências locais" }} />
      </Stack>
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
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}
