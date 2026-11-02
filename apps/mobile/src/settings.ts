import { formatMoney, formatRelativeTime } from "./format";
import type { HiddenOffer } from "./types";

export interface NotificationPermission {
  granted: boolean;
  /** False once Android stops showing the question and only its settings can change the answer. */
  canAskAgain: boolean;
}

export function alertsPanelState(
  permission: NotificationPermission,
  alertsEnabled: boolean
): "on" | "off" | "blocked" {
  if (!permission.granted && !permission.canAskAgain) return "blocked";
  return permission.granted && alertsEnabled ? "on" : "off";
}

export function hiddenOfferRow(
  { id, hiddenAt, snapshot }: HiddenOffer,
  now: Date
): { id: string; name: string; meta: string } {
  const when = `ocultada ${formatRelativeTime(hiddenAt, now)}`;
  return snapshot
    ? {
        id,
        name: snapshot.name,
        meta: `${snapshot.storeName} · ${formatMoney(snapshot.priceCents)} · ${when}`
      }
    : { id, name: "Oferta ocultada", meta: when };
}

function namesSummary(names: readonly string[]): string {
  const [first] = names;
  if (first === undefined) return "Nenhuma";
  return names.length === 1 ? first : `${first} e mais ${names.length - 1}`;
}

export function hiddenOffersSummary(hidden: readonly HiddenOffer[]): string {
  return namesSummary(hidden.map(({ snapshot }) => snapshot?.name ?? "Oferta ocultada"));
}

export interface PublicStore {
  name: string;
  domain: string;
}

const normalize = (value: string) => value.trim().toLocaleLowerCase("pt-BR");

const isSameStore = (store: PublicStore, blocked: string) =>
  normalize(blocked) === normalize(store.domain) || normalize(blocked) === normalize(store.name);

/** A block is saved as a name or a domain; it stays visible even if the store left the list. */
export function blockedStoreRows(
  blocked: readonly string[],
  stores: readonly PublicStore[]
): Array<{ key: string; name: string; hint: string }> {
  return blocked.map((key) => {
    const store = stores.find((candidate) => isSameStore(candidate, key));
    return { key, name: store?.name ?? key, hint: store?.domain ?? "" };
  });
}

export function availableStores(
  stores: readonly PublicStore[],
  blocked: readonly string[]
): PublicStore[] {
  return stores.filter((store) => !blocked.some((key) => isSameStore(store, key)));
}

export function blockedStoresSummary(
  blocked: readonly string[],
  stores: readonly PublicStore[]
): string {
  return namesSummary(blockedStoreRows(blocked, stores).map(({ name }) => name));
}
