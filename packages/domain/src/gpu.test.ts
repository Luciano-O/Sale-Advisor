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

  // The taxonomy now covers the GPUs sold in Brazil in 2026; older generations stay outside it.
  it("returns null for products outside MVP taxonomy", () => {
    expect(identifyGpuProduct("RTX 2070 Super usada em promocao")).toBeNull();
    expect(identifyGpuProduct("Placa de video RX 580 8GB")).toBeNull();
  });

  it("recognizes the RTX 50 and RX 9000 lineups", () => {
    const models = [
      ["Placa De Video Inno3D Rtx 5050 Twin X2 8GB", "RTX 5050", "NVIDIA"],
      ["ZOTAC GAMING GEFORCE RTX 5060 8GB GDDR7", "RTX 5060", "NVIDIA"],
      ["Palit GeForce RTX 5060 Ti Dual 16GB", "RTX 5060 Ti", "NVIDIA"],
      ["Gigabyte RTX 5070 Windforce OC 12GB", "RTX 5070", "NVIDIA"],
      ["Asus Prime RTX 5070 Ti 16GB", "RTX 5070 Ti", "NVIDIA"],
      ["MSI RTX 5080 Ventus 3X 16GB", "RTX 5080", "NVIDIA"],
      ["Placa de video RTX 5090 32GB", "RTX 5090", "NVIDIA"],
      ["Placa De Video Asrock RX 9060 XT Challenger 16GB", "RX 9060 XT", "AMD"],
      ["Asrock Radeon RX 9070 Challenger 16GB", "RX 9070", "AMD"],
      ["Sapphire Pulse RX 9070 XT 16GB", "RX 9070 XT", "AMD"]
    ] as const;

    for (const [text, model, vendor] of models) {
      expect(identifyGpuProduct(text), text).toMatchObject({ model, vendor });
    }
  });

  it("keeps Ti, Super, XT, XTX and GRE variants apart from the base model", () => {
    const variants = [
      ["RTX 3060 Ti 8GB", "RTX 3060 Ti"],
      ["RTX 4070 Ti 12GB", "RTX 4070 Ti"],
      ["RTX 4070 Ti Super 16GB", "RTX 4070 Ti Super"],
      ["RTX 4070 SUPER 12GB", "RTX 4070 Super"],
      ["RTX 4080 Super 16GB", "RTX 4080 Super"],
      ["RX 7600 XT 16GB", "RX 7600 XT"],
      ["RX 6600 XT 8GB", "RX 6600 XT"],
      ["RX 7900 XTX 24GB", "RX 7900 XTX"],
      ["RX 7900 GRE 16GB", "RX 7900 GRE"]
    ] as const;

    for (const [text, model] of variants) {
      expect(identifyGpuProduct(text)?.model, text).toBe(model);
    }
  });

  it("accepts compact spellings without spaces", () => {
    expect(identifyGpuProduct("Placa Video Msi Geforce Rtx5060 Ti Ventus 2x")?.model).toBe(
      "RTX 5060 Ti"
    );
    expect(identifyGpuProduct("rtx5060ti 16gb")?.model).toBe("RTX 5060 Ti");
    expect(identifyGpuProduct("Radeon RX9070XT 16GB")?.model).toBe("RX 9070 XT");
  });

  it("uses the first GPU model mentioned in the message", () => {
    expect(identifyGpuProduct("RTX 5070 mais barata que a RTX 4070 Super")?.model).toBe("RTX 5070");
  });

  it("takes the VRAM closest to the model, preferring the amount after it", () => {
    expect(identifyGpuProduct("RTX 5060 Ti 16GB GDDR7, roda bem com 8GB de RAM")).toMatchObject({
      id: "nvidia-rtx-5060-ti-16gb",
      vramGb: 16
    });
    expect(identifyGpuProduct("Kit 8GB RAM + 16GB RX 9070 XT")).toMatchObject({
      id: "amd-rx-9070-xt-16gb",
      vramGb: 16
    });
    expect(identifyGpuProduct("RTX 5090 32GB")?.vramGb).toBe(32);
    expect(identifyGpuProduct("RTX 5060 Ti sem memoria informada")).toMatchObject({
      id: "nvidia-rtx-5060-ti-unknown-vram",
      vramGb: null
    });
  });

  it("rejects notebooks and complete computers that mention a GPU", () => {
    expect(identifyGpuProduct("Notebook Gamer Acer Nitro V15 RTX 5050 16GB")).toBeNull();
    expect(identifyGpuProduct("PC Gamer completo com placa de vídeo RTX 5060 8GB")).toBeNull();
    expect(identifyGpuProduct("Laptop ASUS TUF RTX 4060")).toBeNull();
    expect(identifyGpuProduct("Computador Gamer Ryzen 5 RX 7600")).toBeNull();
  });

  it("keeps GPU listings that only mention computers as a use case", () => {
    expect(identifyGpuProduct("Placa de vídeo RTX 5060 8GB ideal para PC gamer")?.model).toBe(
      "RTX 5060"
    );
    expect(identifyGpuProduct("Placa de Vídeo para PC Gamer RTX 5060 8GB")?.model).toBe("RTX 5060");
  });
});
