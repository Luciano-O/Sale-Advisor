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
        trigger: { channelId: OFFERS_CHANNEL_ID }
      });
    }
  };
}

const OFFERS_CHANNEL_ID = "offers";

export async function configureNotificationChannel(): Promise<void> {
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync(OFFERS_CHANNEL_ID, {
      name: "Ofertas relevantes",
      importance: Notifications.AndroidImportance.HIGH
    });
}

async function devicePushToken(): Promise<string | null> {
  try {
    const token = await Notifications.getDevicePushTokenAsync();
    return typeof token.data === "string" ? token.data : null;
  } catch {
    return null;
  }
}

/** Never asks the user: the question belongs to the Alertas step of the onboarding. */
export async function currentPushToken(): Promise<string | null> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted" ? devicePushToken() : null;
}

/** Asks Android for permission; false when the user refused. */
export async function requestPushPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  const permission =
    current.status === "granted" ? current : await Notifications.requestPermissionsAsync();
  return permission.status === "granted";
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
