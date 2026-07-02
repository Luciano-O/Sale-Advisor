import { describe, expect, it } from "vitest";

import { identifyGpuProduct } from "./gpu.js";

describe("identifyGpuProduct", () => {
  it("recognizes compact and spaced RTX 4060 variants", () => {
    expect(identifyGpuProduct("GeForce RTX4060 8GB")?.model).toBe("RTX 4060");
    expect(identifyGpuProduct("Placa de video RTX 4060")?.model).toBe("RTX 4060");
    expect(identifyGpuProduct("GeForce RTX 4060 OC")?.vendor).toBe("NVIDIA");
  });

  it("differentiates RTX 4060 from RTX 4060 Ti", () => {
    expect(identifyGpuProduct("RTX 4060 Ti 8GB")?.model).toBe("RTX 4060 Ti");
    expect(identifyGpuProduct("RTX 4060 8GB")?.model).toBe("RTX 4060");
  });

  it("recognizes RX 7700 XT", () => {
    expect(identifyGpuProduct("Sapphire Radeon RX 7700 XT")?.model).toBe("RX 7700 XT");
  });

  it("returns null for products outside MVP taxonomy", () => {
    expect(identifyGpuProduct("RTX 4090 em promocao")).toBeNull();
  });
});
