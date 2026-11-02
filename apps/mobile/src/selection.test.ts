import { describe, expect, it } from "vitest";

import { searchProducts, toggleModel } from "./selection";

describe("toggleModel", () => {
  it("adds a model that is not followed yet", () => {
    expect(toggleModel(["RTX 5060"], "RX 9070 XT")).toEqual(["RTX 5060", "RX 9070 XT"]);
  });

  it("removes a followed model regardless of letter case", () => {
    expect(toggleModel(["rtx 5060", "RX 9070 XT"], "RTX 5060")).toEqual(["RX 9070 XT"]);
  });
});

describe("searchProducts", () => {
  const gpu = (vendor: string, model: string) => ({ category: "GPU", vendor, model });
  const catalog = [
    gpu("NVIDIA", "RTX 5060"),
    gpu("NVIDIA", "RTX 5060 Ti"),
    gpu("NVIDIA", "RTX 5070"),
    gpu("AMD", "RX 9060 XT"),
    gpu("AMD", "RX 9070 XT"),
    { category: "CPU", vendor: "AMD", model: "Ryzen 7 9800X3D" }
  ];
  const models = (query: string, limit?: number) =>
    searchProducts(catalog, query, "GPU", limit).results.map(({ model }) => model);

  it("finds a model ignoring case", () => {
    expect(models("rx 90")).toEqual(["RX 9060 XT", "RX 9070 XT"]);
  });

  it("matches words in any order", () => {
    expect(models("ti 5060")).toEqual(["RTX 5060 Ti"]);
  });

  it("searches only the subcategory being edited", () => {
    expect(models("ryzen")).toEqual([]);
  });

  it("lists the subcategory before anything is typed", () => {
    expect(models("  ")).toEqual([
      "RTX 5060",
      "RTX 5060 Ti",
      "RTX 5070",
      "RX 9060 XT",
      "RX 9070 XT"
    ]);
  });

  it("limits the results and reports how many there are", () => {
    const search = searchProducts(catalog, "rtx", "GPU", 2);
    expect(search.results).toHaveLength(2);
    expect(search.total).toBe(3);
  });

  it("splits the name around what was typed, for highlighting", () => {
    expect(searchProducts(catalog, "rx 90", "GPU").results[0]).toEqual({
      model: "RX 9060 XT",
      vendor: "AMD",
      pre: "",
      match: "RX 90",
      post: "60 XT"
    });
    expect(searchProducts(catalog, "5070", "GPU").results[0]).toMatchObject({
      pre: "RTX ",
      match: "5070",
      post: ""
    });
  });

  it("highlights nothing when the words are not contiguous", () => {
    expect(searchProducts(catalog, "ti 5060", "GPU").results[0]).toMatchObject({
      pre: "RTX 5060 Ti",
      match: "",
      post: ""
    });
  });
});
