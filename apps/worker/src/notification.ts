export interface NotificationPayload {
  offerId: string;
}
export interface NotificationTarget {
  installationId: string;
  token: string | null;
}
export interface NotificationProvider {
  readonly name: "fake" | "fcm";
  send(target: NotificationTarget, payload: NotificationPayload): Promise<void>;
}

export const NOTIFICATION_PROVIDER = Symbol("NOTIFICATION_PROVIDER");

export class FakeNotificationProvider implements NotificationProvider {
  readonly name = "fake" as const;
  readonly deliveries: Array<{ target: NotificationTarget; payload: NotificationPayload }> = [];
  async send(target: NotificationTarget, payload: NotificationPayload) {
    this.deliveries.push({ target, payload });
  }
}

export class FcmNotificationProvider implements NotificationProvider {
  readonly name = "fcm" as const;
  async send(target: NotificationTarget, payload: NotificationPayload) {
    if (!target.token) throw new Error("FCM target is missing");
    const { getApps, initializeApp, applicationDefault } = await import("firebase-admin/app");
    const { getMessaging } = await import("firebase-admin/messaging");
    if (getApps().length === 0) initializeApp({ credential: applicationDefault() });
    await getMessaging().send({
      token: target.token,
      data: { offerId: payload.offerId },
      android: { priority: "high" }
    });
  }
}

export function createNotificationProvider(environment = process.env): NotificationProvider {
  return environment.NOTIFICATION_PROVIDER === "fcm"
    ? new FcmNotificationProvider()
    : new FakeNotificationProvider();
}
