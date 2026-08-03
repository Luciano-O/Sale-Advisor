import { router, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Alert, View } from "react-native";

import {
  developmentNotificationDelegate,
  handleDevelopmentNotificationLink
} from "../src/dev-notification-link";
import { notificationDependencies } from "../src/notifications";
import { colors } from "../src/theme";

export default function DevelopmentNotificationRoute() {
  const sqlite = useSQLiteContext();
  const { offerId } = useLocalSearchParams<{ offerId?: string | string[] }>();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    if (!__DEV__) {
      router.replace("/");
      return;
    }

    const id = Array.isArray(offerId) ? offerId[0] : offerId;
    const url = id
      ? `saleadvisor://debug-notification?offerId=${encodeURIComponent(id)}`
      : "saleadvisor://debug-notification";

    void handleDevelopmentNotificationLink(
      url,
      __DEV__,
      developmentNotificationDelegate(notificationDependencies(sqlite))
    )
      .then((result) => {
        Alert.alert("Debug de notificação", `Resultado: ${result}`, [
          { text: "OK", onPress: () => router.replace("/") }
        ]);
      })
      .catch((error: unknown) => {
        Alert.alert(
          "Debug de notificação",
          `Falha: ${error instanceof Error ? error.message : "erro desconhecido"}`,
          [{ text: "OK", onPress: () => router.replace("/") }]
        );
      });
  }, [offerId, sqlite]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}
