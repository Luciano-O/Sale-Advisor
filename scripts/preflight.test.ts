import { describe, expect, it } from "vitest";

import { validateToolVersions } from "./preflight.mjs";

describe("baseline tool versions", () => {
  it("accepts Node 24 and pnpm 11.7.0", () => {
    expect(validateToolVersions({ node: "v24.18.0", pnpm: "11.7.0" })).toEqual([]);
  });

  it.each([
    [{ node: "v20.19.0", pnpm: "11.7.0" }, /Node 24\.x/],
    [{ node: "v25.0.0", pnpm: "11.7.0" }, /Node 24\.x/],
    [{ node: "v24.18.0", pnpm: "11.9.0" }, /pnpm 11\.7\.0/]
  ])("rejects incompatible versions: %o", (versions, expected) => {
    expect(validateToolVersions(versions).join("\n")).toMatch(expected);
  });
});
