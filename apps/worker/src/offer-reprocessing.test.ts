import { describe, expect, it } from "vitest";

import { planOfferReprocessing } from "./offer-reprocessing.js";

describe("offer derivation reprocessing", () => {
  it("supersedes prior active derivations and identifies affected offers", () => {
    expect(
      planOfferReprocessing({
        rawMessageId: "raw-1",
        currentParseId: "parse-3",
        mentions: [
          {
            id: "mention-1",
            rawMessageId: "raw-1",
            parseId: "parse-1",
            offerId: "old",
            active: true
          },
          {
            id: "mention-2",
            rawMessageId: "raw-1",
            parseId: "parse-2",
            offerId: "old",
            active: false
          },
          {
            id: "mention-3",
            rawMessageId: "other",
            parseId: "parse-x",
            offerId: "other",
            active: true
          }
        ],
        snapshots: [
          {
            id: "snapshot-1",
            rawMessageId: "raw-1",
            parseId: "parse-1",
            offerId: "old",
            active: true
          },
          {
            id: "snapshot-2",
            rawMessageId: "raw-1",
            parseId: "parse-2",
            offerId: "old",
            active: false
          }
        ]
      })
    ).toEqual({
      mentionIdsToDeactivate: ["mention-1"],
      snapshotIdsToSupersede: ["snapshot-1"],
      affectedOfferIds: ["old"]
    });
  });
});
