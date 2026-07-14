import * as Notifications from "expo-notifications";
import type { SQLiteDatabase } from "expo-sqlite";
import { Platform } from "react-native";

import { fetchOffer } from "./api";
import { createMobileDatabase } from "./database";
import type { MobileOffer } from "./types";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export function notificationDependencies(database: SQLiteDatabase) {
  const local = createMobileDatabase(database);
  return {
    getOffer: fetchOffer,
    getPreferences: () => local.getPreferences(),
    getHiddenIds: () => local.getHiddenIds(),
    wasShown: (id: string) => local.wasNotificationShown(id),
    markShown: (id: string) => local.markNotificationShown(id),
    showLocalNotification: async (offer: MobileOffer) => {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${offer.label.replace("_", " ")} · ${offer.product.model}`,
          body: `${formatMoney(offer.effectivePriceCents)} em ${offer.store.name}`,
          data: { offerId: offer.id, locallyPresented: true }
        },
        trigger: null
      });
    }
  };
}

export async function configureNotificationChannel(): Promise<void> {
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("offers", {
      name: "Ofertas relevantes",
      importance: Notifications.AndroidImportance.HIGH
    });
}

export async function requestNativePushToken(): Promise<string | null> {
  const current = await Notifications.getPermissionsAsync();
  const permission =
    current.status === "granted" ? current : await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") return null;
  try {
    const token = await Notifications.getDevicePushTokenAsync();
    return typeof token.data === "string" ? token.data : null;
  } catch {
    return null;
  }
}

export function subscribeToNotifications(onOpenOffer: (offerId: string) => void): () => void {
  const response = Notifications.addNotificationResponseReceivedListener(({ notification }) => {
    const offerId = notification.request.content.data?.offerId;
    if (typeof offerId === "string") onOpenOffer(offerId);
  });
  void Notifications.getLastNotificationResponseAsync().then((last) => {
    const offerId = last?.notification.request.content.data?.offerId;
    if (typeof offerId === "string") onOpenOffer(offerId);
  });
  return () => {
    response.remove();
  };
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
}
