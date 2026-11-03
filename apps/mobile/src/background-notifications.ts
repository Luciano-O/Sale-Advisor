import * as Notifications from "expo-notifications";
import { openDatabaseAsync } from "expo-sqlite";
import * as TaskManager from "expo-task-manager";

import { createMobileDatabase } from "./database";
import { recordEvent } from "./events";
import { migrateDatabase } from "./migrations";
import { notificationAction, notificationResponseData } from "./notification-content";
import { configureNotifications, notificationDependencies } from "./notifications";
import { handleOfferPush } from "./push";

const BACKGROUND_NOTIFICATION_TASK = "sale-advisor-offer-notification";

if (!TaskManager.isTaskDefined(BACKGROUND_NOTIFICATION_TASK))
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(
    BACKGROUND_NOTIFICATION_TASK,
    async ({ data, error }) => {
      if (error) return Notifications.BackgroundNotificationTaskResult.Failed;
      if ("actionIdentifier" in data) return handleResponse(data);
      const payload = parsePayload(data.data);
      if (payload.locallyPresented) return Notifications.BackgroundNotificationTaskResult.NoData;
      try {
        const sqlite = await openDatabaseAsync("sale-advisor.db");
        await migrateDatabase(sqlite);
        const local = createMobileDatabase(sqlite);
        // The app may never have been opened after install; the channel must exist first.
        await configureNotifications();
        const result = await handleOfferPush(payload, notificationDependencies(sqlite));
        if (result !== "invalid") {
          const installationId = await local.ensureInstallation();
          const { analyticsEnabled } = await local.getPreferences();
          await recordEvent(analyticsEnabled, local, {
            installationId,
            name: "notification_received",
            occurredAt: new Date().toISOString(),
            payload: { offerId: String(payload.offerId), result }
          });
        }
        return result === "shown"
          ? Notifications.BackgroundNotificationTaskResult.NewData
          : Notifications.BackgroundNotificationTaskResult.NoData;
      } catch {
        return Notifications.BackgroundNotificationTaskResult.Failed;
      }
    }
  );

/**
 * "Ocultar" runs here, without opening the app. Every other response opens the app, whose listener
 * takes care of it.
 */
async function handleResponse(response: Notifications.NotificationResponse) {
  const action = notificationAction(
    response.actionIdentifier,
    notificationResponseData(response.notification.request.content)
  );
  if (action?.kind !== "hide") return Notifications.BackgroundNotificationTaskResult.NoData;
  try {
    const sqlite = await openDatabaseAsync("sale-advisor.db");
    await migrateDatabase(sqlite);
    const local = createMobileDatabase(sqlite);
    await local.hideSnapshot(action.offerId, action.snapshot);
    await Notifications.dismissNotificationAsync(response.notification.request.identifier);
    const { analyticsEnabled } = await local.getPreferences();
    await recordEvent(analyticsEnabled, local, {
      installationId: await local.ensureInstallation(),
      name: "product_hidden",
      occurredAt: new Date().toISOString(),
      payload: { offerId: action.offerId }
    });
    return Notifications.BackgroundNotificationTaskResult.NewData;
  } catch {
    return Notifications.BackgroundNotificationTaskResult.Failed;
  }
}

void Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);

function parsePayload(data: { dataString?: string; [key: string]: unknown }) {
  if (typeof data.dataString === "string")
    try {
      return JSON.parse(data.dataString) as Record<string, unknown>;
    } catch {
      return {};
    }
  return data;
}
