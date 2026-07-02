import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { buildOfferCandidate, deduplicateOfferCandidates } from "@sale-advisor/domain";
import type { DeduplicationResult } from "@sale-advisor/domain";

export interface RawFixtureMessage {
  id: string;
  sourceName: string;
  text: string;
  capturedAt: string;
}

export interface ProcessFixturesOptions {
  inputPath?: string;
  outputPath?: string;
}

const DEFAULT_INPUT_PATH = join(process.cwd(), "fixtures", "raw-messages.json");
const DEFAULT_OUTPUT_PATH = join(process.cwd(), "output", "offers.json");

export function processRawMessages(rawMessages: RawFixtureMessage[]): DeduplicationResult {
  const candidates = rawMessages.map((message) =>
    buildOfferCandidate({
      rawMessageId: message.id,
      sourceName: message.sourceName,
      rawText: message.text,
      capturedAt: message.capturedAt
    })
  );

  return deduplicateOfferCandidates(candidates);
}

export async function processFixtureFile(options: ProcessFixturesOptions = {}): Promise<DeduplicationResult> {
  const inputPath = options.inputPath ?? DEFAULT_INPUT_PATH;
  const outputPath = options.outputPath ?? DEFAULT_OUTPUT_PATH;
  const rawMessages = parseRawMessages(JSON.parse(await readFile(inputPath, "utf8")));
  const result = processRawMessages(rawMessages);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  return result;
}

function parseRawMessages(value: unknown): RawFixtureMessage[] {
  if (!Array.isArray(value)) {
    throw new TypeError("raw-messages fixture must be an array");
  }

  return value.map((item, index) => parseRawMessage(item, index));
}

function parseRawMessage(value: unknown, index: number): RawFixtureMessage {
  if (!isRecord(value)) {
    throw new TypeError(`raw message at index ${index} must be an object`);
  }

  const id = value["id"];
  const sourceName = value["sourceName"];
  const text = value["text"];
  const capturedAt = value["capturedAt"];

  if (typeof id !== "string" || typeof sourceName !== "string" || typeof text !== "string" || typeof capturedAt !== "string") {
    throw new TypeError(`raw message at index ${index} must include string id, sourceName, text and capturedAt`);
  }

  return {
    id,
    sourceName,
    text,
    capturedAt: new Date(capturedAt).toISOString()
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
