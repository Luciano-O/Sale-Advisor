import type { PendingEvent } from "./types";

export interface PendingEventStore {
  list(limit: number): Promise<PendingEvent[]>;
  remove(ids: string[]): Promise<void>;
  markFailed(ids: string[], error: string): Promise<void>;
}

export async function flushPendingEvents(
  store: PendingEventStore,
  send: (events: PendingEvent[]) => Promise<void>,
  limit = 100
): Promise<number> {
  const events = await store.list(limit);
  if (events.length === 0) return 0;
  const ids = events.map(({ id }) => id);
  try {
    await send(events);
    await store.remove(ids);
    return events.length;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao enviar eventos";
    await store.markFailed(ids, message);
    throw error;
  }
}
