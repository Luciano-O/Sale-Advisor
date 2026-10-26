import { describe, expect, it } from "vitest";

import { modelChoices, toggleModel } from "./selection";

describe("toggleModel", () => {
  it("adds a model that is not followed yet", () => {
    expect(toggleModel(["RTX 5060"], "RX 9070 XT")).toEqual(["RTX 5060", "RX 9070 XT"]);
  });

  it("removes a followed model regardless of letter case", () => {
    expect(toggleModel(["rtx 5060", "RX 9070 XT"], "RTX 5060")).toEqual(["RX 9070 XT"]);
  });
});

describe("modelChoices", () => {
  it("lists catalog models and keeps followed models missing from the catalog", () => {
    expect(
      modelChoices(
        [
          { vendor: "AMD", model: "RX 9070 XT" },
          { vendor: "NVIDIA", model: "RTX 5060" }
        ],
        ["rtx 5060", "RTX 3060 Ti"]
      )
    ).toEqual(["RX 9070 XT", "RTX 5060", "RTX 3060 Ti"]);
  });
});
