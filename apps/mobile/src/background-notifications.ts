import * as Notifications from "expo-notifications";
import { openDatabaseAsync } from "expo-sqlite";
import * as TaskManager from "expo-task-manager";

import { createMobileDatabase } from "./database";
import { migrateDatabase } from "./migrations";
import { notificationDependencies } from "./notifications";
import { handleOfferPush } from "./push";

const BACKGROUND_NOTIFICATION_TASK = "sale-advisor-offer-notification";

if (!TaskManager.isTaskDefined(BACKGROUND_NOTIFICATION_TASK))
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(
    BACKGROUND_NOTIFICATION_TASK,
    async ({ data, error }) => {
      if (error || "actionIdentifier" in data)
        return Notifications.BackgroundNotificationTaskResult.Failed;
      const payload = parsePayload(data.data);
      if (payload.locallyPresented) return Notifications.BackgroundNotificationTaskResult.NoData;
      try {
        const sqlite = await openDatabaseAsync("sale-advisor.db");
        await migrateDatabase(sqlite);
        const local = createMobileDatabase(sqlite);
        const result = await handleOfferPush(payload, notificationDependencies(sqlite));
        if (result !== "invalid") {
          const installationId = await local.ensureInstallation();
          await local.enqueueEvent({
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
