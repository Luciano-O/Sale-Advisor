import type { PushDependencies } from "./push";
import { handleOfferPush } from "./push";

type PushResult = Awaited<ReturnType<typeof handleOfferPush>>;
type PushDelegate = (data: Record<string, unknown>) => Promise<PushResult>;

export async function handleDevelopmentNotificationLink(
  url: string,
  development: boolean,
  delegate: PushDelegate
): Promise<PushResult | "disabled" | "ignored"> {
  if (!development) return "disabled";

  const parsed = new URL(url);
  if (parsed.protocol !== "saleadvisor:" || parsed.hostname !== "debug-notification") {
    return "ignored";
  }

  const offerId = parsed.searchParams.get("offerId");
  if (!offerId) return "invalid";
  return delegate({ offerId });
}

export function developmentNotificationDelegate(dependencies: PushDependencies): PushDelegate {
  return (data) => handleOfferPush(data, dependencies);
}
