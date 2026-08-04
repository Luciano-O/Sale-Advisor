import { readFileSync } from "node:fs";

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

describe("baseline test prerequisites", () => {
  it("builds workspace package entrypoints before running tests", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8")
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts["build:test-dependencies"]).toBe(
      "corepack pnpm -r --filter @sale-advisor/config --filter @sale-advisor/shared --filter @sale-advisor/contracts --filter @sale-advisor/domain --filter @sale-advisor/database --if-present build"
    );
    expect(packageJson.scripts.test).toMatch(
      /^corepack pnpm build:test-dependencies && vitest run scripts\/preflight\.test\.ts/u
    );
  });
});
