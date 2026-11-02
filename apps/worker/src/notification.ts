/** What the app needs to filter and show an offer without fetching it. */
export interface OfferNotificationSummary {
  productId: string;
  vendor: string;
  model: string;
  vramGb: number | null;
  storeName: string;
  storeDomain: string;
  priceCents: number;
  label: string;
  // The verdict line of the alert and its actions. Optional because deliveries recorded before
  // they existed lack them; null when the history or the offer has no value.
  discountVsMedianPercent?: number | null;
  median30dInCents?: number | null;
  lowest90dInCents?: number | null;
  coupon?: string | null;
  url?: string | null;
}

export interface NotificationPayload {
  offerId: string;
  summary?: OfferNotificationSummary;
}

// An offer still undelivered after a day is no longer worth a notification.
const FCM_TTL_MS = 24 * 60 * 60 * 1_000;
// FCM rejects data payloads over 4 KB, counting keys and values.
const FCM_DATA_LIMIT_BYTES = 4_096;

function dataSize(data: Record<string, string>): number {
  return Object.entries(data).reduce(
    (total, [key, value]) => total + Buffer.byteLength(key) + Buffer.byteLength(value),
    0
  );
}

/** FCM data payloads only carry strings; the summary travels as JSON. */
export function buildFcmMessage(token: string, payload: NotificationPayload) {
  const data: Record<string, string> = {
    offerId: payload.offerId,
    ...(payload.summary ? { offer: JSON.stringify(payload.summary) } : {})
  };
  // Only the store link can be long; without it "Abrir na loja" falls back to the detail.
  if (payload.summary && dataSize(data) > FCM_DATA_LIMIT_BYTES) {
    const summary = { ...payload.summary };
    delete summary.url;
    data.offer = JSON.stringify(summary);
  }
  return {
    token,
    data,
    android: { priority: "high" as const, ttl: FCM_TTL_MS }
  };
}
export interface NotificationTarget {
  installationId: string;
  token: string | null;
}
export interface NotificationProvider {
  readonly name: "fake" | "fcm";
  send(target: NotificationTarget, payload: NotificationPayload): Promise<void>;
}

const PERMANENT_FCM_ERROR_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
  "messaging/mismatched-credential",
  "messaging/invalid-argument"
]);

export class NotificationSendError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean
  ) {
    super(code);
    this.name = "NotificationSendError";
  }
}

export function asNotificationSendError(error: unknown): NotificationSendError {
  if (error instanceof NotificationSendError) return error;
  const code =
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code
      : "messaging/unknown-error";
  return new NotificationSendError(code, !PERMANENT_FCM_ERROR_CODES.has(code));
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
    if (!target.token) throw new NotificationSendError("messaging/missing-token", false);
    try {
      const { getApps, initializeApp, applicationDefault } = await import("firebase-admin/app");
      const { getMessaging } = await import("firebase-admin/messaging");
      if (getApps().length === 0) initializeApp({ credential: applicationDefault() });
      await getMessaging().send(buildFcmMessage(target.token, payload));
    } catch (error) {
      throw asNotificationSendError(error);
    }
  }
}

export function createNotificationProvider(environment = process.env): NotificationProvider {
  return environment.NOTIFICATION_PROVIDER === "fcm"
    ? new FcmNotificationProvider()
    : new FakeNotificationProvider();
}
