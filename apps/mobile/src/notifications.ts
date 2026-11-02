import * as Notifications from "expo-notifications";
import type { SQLiteDatabase } from "expo-sqlite";
import { Platform } from "react-native";

import { fetchOffer } from "./api";
import { createMobileDatabase } from "./database";
import { colors } from "./theme";
import {
  ACTION_HIDE,
  ACTION_OPEN_STORE,
  OFFER_CATEGORY,
  OFFER_CHANNELS,
  buildOfferNotification,
  notificationAction,
  type NotificationAction
} from "./notification-content";
import type { NotificationPermission } from "./settings";
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
      const { channelId, ...content } = buildOfferNotification(offer);
      await Notifications.scheduleNotificationAsync({
        content: { ...content, color: colors.cobalt },
        trigger: { channelId }
      });
    }
  };
}

const LEGACY_CHANNEL_ID = "offers";
const CHANNEL_IMPORTANCE = {
  low: Notifications.AndroidImportance.LOW,
  default: Notifications.AndroidImportance.DEFAULT,
  high: Notifications.AndroidImportance.HIGH
};

/** Registers the channels and actions; the app may never have opened before a push arrives. */
export async function configureNotifications(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.deleteNotificationChannelAsync(LEGACY_CHANNEL_ID);
  for (const { id, name, level, sound, vibrate } of OFFER_CHANNELS)
    await Notifications.setNotificationChannelAsync(id, {
      name,
      importance: CHANNEL_IMPORTANCE[level],
      ...(sound ? {} : { sound: null }),
      enableVibrate: vibrate,
      lightColor: colors.cobalt
    });
  await Notifications.setNotificationCategoryAsync(OFFER_CATEGORY, [
    {
      identifier: ACTION_OPEN_STORE,
      buttonTitle: "Abrir na loja",
      options: { opensAppToForeground: true }
    },
    { identifier: ACTION_HIDE, buttonTitle: "Ocultar", options: { opensAppToForeground: false } }
  ]);
}

export async function notificationPermission(): Promise<NotificationPermission> {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  return { granted: status === "granted", canAskAgain };
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

function actionOf(response: Notifications.NotificationResponse): NotificationAction | null {
  return notificationAction(response.actionIdentifier, response.notification.request.content.data);
}

export function subscribeToNotifications(
  onAction: (action: NotificationAction) => void
): () => void {
  const handle = (response: Notifications.NotificationResponse) => {
    const action = actionOf(response);
    if (action) onAction(action);
    if (action?.kind === "hide")
      void Notifications.dismissNotificationAsync(response.notification.request.identifier);
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  void Notifications.getLastNotificationResponseAsync().then((last) => {
    if (!last) return;
    handle(last);
    // Otherwise every later start of the app would answer this same notification again.
    void Notifications.clearLastNotificationResponseAsync();
  });
  return () => {
    subscription.remove();
  };
}
