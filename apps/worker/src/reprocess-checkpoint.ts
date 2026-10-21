import { readFile } from "node:fs/promises";

export interface Checkpoint {
  /** created_at as PostgreSQL text, keeping microseconds for an exact keyset cursor. */
  createdAt: string;
  id: string;
  processed: number;
}

export interface TargetRow {
  id: string;
  createdAt: string;
}

export function advanceCheckpoint(previous: Checkpoint | null, rows: TargetRow[]): Checkpoint {
  const last = rows.at(-1);
  if (!last) throw new Error("Cannot advance a checkpoint without rows");
  return {
    createdAt: last.createdAt,
    id: last.id,
    processed: (previous?.processed ?? 0) + rows.length
  };
}

export async function readCheckpoint(path: string): Promise<Checkpoint | null> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as Checkpoint;
    return parsed.createdAt && parsed.id && Number.isSafeInteger(parsed.processed) ? parsed : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
