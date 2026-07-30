import { describe, expect, it } from "vitest";

import { mapTelegramMessage, serializeTelegramValue } from "./telegram-message.js";

describe("mapTelegramMessage", () => {
  it("preserves text, large ids, raw payload and visible/hidden URLs", () => {
    const mapped = mapTelegramMessage(
      {
        id: 42,
        peerId: { toString: () => "-100123456789012345" },
        senderId: { toString: () => "9007199254740993" },
        message: "RTX 4060 R$ 1.899 https://t.me/ofertas e loja",
        date: 1_785_412_800,
        entities: [
          { className: "MessageEntityUrl", offset: 18, length: 20 },
          {
            className: "MessageEntityTextUrl",
            offset: 43,
            length: 4,
            url: "https://shop.example/gpu?sku=4060&utm_source=tg"
          }
        ],
        toJSON: () => ({
          id: 42,
          peerId: { toString: () => "-100123456789012345" },
          message: "RTX 4060 R$ 1.899 https://t.me/ofertas e loja"
        })
      },
      { chatTitle: "Ofertas GPU", chatUsername: "ofertas", notifyEligible: true }
    );

    expect(mapped).toMatchObject({
      peerId: "-100123456789012345",
      messageId: "42",
      senderId: "9007199254740993",
      text: "RTX 4060 R$ 1.899 https://t.me/ofertas e loja",
      capturedAt: "2026-07-30T12:00:00.000Z",
      notifyEligible: true,
      chatTitle: "Ofertas GPU",
      chatUsername: "ofertas"
    });
    expect(mapped.urls).toEqual([
      "https://t.me/ofertas",
      "https://shop.example/gpu?sku=4060&utm_source=tg"
    ]);
    expect(mapped.originalPayload).toMatchObject({
      id: 42,
      peerId: "-100123456789012345",
      capturedUrls: mapped.urls
    });
  });

  it("preserves media-only messages with empty text", () => {
    expect(
      mapTelegramMessage(
        {
          id: 7,
          peerId: "-1007",
          message: "",
          date: new Date("2026-07-30T12:00:00.000Z"),
          entities: [],
          toJSON: () => ({ id: 7, message: "", media: { className: "MessageMediaPhoto" } })
        },
        { notifyEligible: false }
      )
    ).toMatchObject({
      text: "",
      urls: [],
      notifyEligible: false,
      originalPayload: { media: { className: "MessageMediaPhoto" } }
    });
  });
});

describe("serializeTelegramValue", () => {
  it("converts bigint-like values recursively into JSON-safe strings", () => {
    expect(
      serializeTelegramValue({
        native: 9_007_199_254_740_993n,
        library: { toString: () => "9007199254740994" },
        buffer: Buffer.from("ok")
      })
    ).toEqual({
      native: "9007199254740993",
      library: "9007199254740994",
      buffer: "b2s="
    });
  });
});
