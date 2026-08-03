import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { processFixtureFile, processRawMessages } from "./process-fixtures.js";
import type { RawFixtureMessage } from "./process-fixtures.js";

describe("processRawMessages", () => {
  it("turns valid raw fixture messages into offers and offer mentions", () => {
    const result = processRawMessages([
      rawMessage({
        id: "fixture-1",
        text: "RTX 4060 por R$ 1.899,00 https://loja-a.example.br/gpu?sku=4060&utm_source=tg"
      }),
      rawMessage({
        id: "fixture-2",
        text: "RTX 4060 por R$ 1.899,00 https://loja-a.example.br/oferta/4060?sku=4060&fbclid=abc",
        capturedAt: "2026-07-02T11:00:00.000Z"
      })
    ]);

    expect(result.offers).toHaveLength(1);
    expect(result.offerMentions).toHaveLength(2);
    expect(result.offers[0]?.mentionCount).toBe(2);
  });

  it("preserves normalized store data in offers and mentions", () => {
    const result = processRawMessages([
      rawMessage({
        id: "store-1",
        text: "RTX 4060 por R$ 1.899,00 https://loja-a.example.br/gpu?sku=4060&utm_source=tg"
      }),
      rawMessage({
        id: "store-2",
        text: "RTX 4060 por R$ 1.899,00 https://loja-a.example.br/oferta/4060?sku=4060&fbclid=abc",
        capturedAt: "2026-07-02T11:00:00.000Z"
      })
    ]);

    expect(result.offers[0]?.storeProductId).toBe("4060");
    expect(result.offers[0]?.store.domain).toBe("loja-a.example.br");
    expect(result.offerMentions[0]?.candidate.storeProductId).toBe("4060");
    expect(result.offerMentions[0]?.candidate.store?.adapterName).toBe("loja-a");
  });

  it("is deterministic for the same input", () => {
    const messages = [
      rawMessage({ id: "fixture-2", text: "RX 7600 por R$ 1.499,00 https://shop.test/rx7600" }),
      rawMessage({
        id: "fixture-1",
        text: "RTX 4070 por R$ 3.299,00 https://shop.test/rtx4070",
        capturedAt: "2026-07-02T09:00:00.000Z"
      })
    ];

    expect(processRawMessages(messages)).toEqual(processRawMessages(messages));
  });

  it("does not break the pipeline for a partial message without price or product", () => {
    const result = processRawMessages([
      rawMessage({ id: "partial-1", text: "Oferta chegando em breve no canal" }),
      rawMessage({ id: "valid-1", text: "RX 6600 por R$ 1.099,00 https://shop.test/rx6600" })
    ]);

    expect(result.offers).toHaveLength(1);
    expect(result.offerMentions).toHaveLength(1);
    expect(result.offerMentions[0]?.rawMessageId).toBe("valid-1");
  });

  it("returns empty arrays for an empty fixture", () => {
    expect(processRawMessages([])).toEqual({
      offers: [],
      offerMentions: []
    });
  });

  it("validates, processes and writes a fixture file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "sale-advisor-worker-"));
    const inputPath = join(directory, "input.json");
    const outputPath = join(directory, "nested", "output.json");
    try {
      await writeFile(inputPath, JSON.stringify([rawMessage({})]), "utf8");
      expect((await processFixtureFile({ inputPath, outputPath })).offers).toHaveLength(1);
      expect(JSON.parse(await readFile(outputPath, "utf8")).offers).toHaveLength(1);
      await writeFile(inputPath, JSON.stringify({ invalid: true }), "utf8");
      await expect(processFixtureFile({ inputPath, outputPath })).rejects.toThrow(/array/);
      await writeFile(inputPath, JSON.stringify([null]), "utf8");
      await expect(processFixtureFile({ inputPath, outputPath })).rejects.toThrow(/object/);
      await writeFile(inputPath, JSON.stringify([{ id: 1 }]), "utf8");
      await expect(processFixtureFile({ inputPath, outputPath })).rejects.toThrow(/string id/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

function rawMessage(overrides: Partial<RawFixtureMessage>): RawFixtureMessage {
  return {
    id: "fixture-1",
    sourceName: "Canal Teste",
    text: "RTX 4060 por R$ 1.899,00 https://loja-a.example.br/gpu?sku=4060",
    capturedAt: "2026-07-02T10:00:00.000Z",
    ...overrides
  };
}
