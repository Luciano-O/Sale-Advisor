import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

// With the app killed, Android boots the JS bundle headless to handle a push: only the entry
// module runs, no screen (and no app/_layout) is ever rendered.
const loaded: string[] = [];

vi.mock("./background-notifications", () => {
  loaded.push("background-notifications");
  return {};
});
vi.mock("expo-router/entry", () => {
  loaded.push("expo-router/entry");
  return {};
});

describe("app entry", () => {
  beforeEach(() => {
    loaded.length = 0;
  });

  it("is the module that registers the background push task", () => {
    const manifestPath = resolve(dirname(fileURLToPath(import.meta.url)), "../package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { main: string };
    expect(manifest.main).toBe("index.ts");
  });

  it("registers the background push task before starting the router", async () => {
    await import("../index");
    expect(loaded).toEqual(["background-notifications", "expo-router/entry"]);
  });
});
