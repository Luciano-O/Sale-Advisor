import { describe, expect, it } from "vitest";

import {
  LABEL_RAMP,
  conditionName,
  labelColor,
  labelName,
  labelTextColor,
  offerName,
  subcategoryName,
  subcategorySingularName
} from "./labels";

describe("label ramp", () => {
  it("always runs in the same order", () => {
    expect(LABEL_RAMP).toEqual(["normal", "boa", "muito_boa", "excepcional"]);
  });

  it("gives each label one name", () => {
    expect(LABEL_RAMP.map(labelName)).toEqual(["Normal", "Boa", "Muito boa", "Excepcional"]);
  });

  it("gives each label one color", () => {
    expect(LABEL_RAMP.map(labelColor)).toEqual(["#DDE1E8", "#9DB0FB", "#2147F0", "#FF6B2C"]);
  });

  it("uses white text only on cobalt", () => {
    expect(LABEL_RAMP.map(labelTextColor)).toEqual(["#0B1220", "#0B1220", "#FFFFFF", "#0B1220"]);
  });
});

describe("offerName", () => {
  it("joins the model and the memory", () => {
    expect(offerName({ model: "RTX 5060", vramGb: 8 })).toBe("RTX 5060 8GB");
  });

  it("is the model alone when the memory is unknown", () => {
    expect(offerName({ model: "RTX 5060", vramGb: null })).toBe("RTX 5060");
  });
});

describe("conditionName", () => {
  it("translates the conditions we detect", () => {
    expect(conditionName("new")).toBe("Novo");
    expect(conditionName("used")).toBe("Usado");
    expect(conditionName("open_box")).toBe("Caixa aberta");
  });

  it("admits when we could not tell", () => {
    expect(conditionName("unknown")).toBe("Não informada");
    expect(conditionName(undefined)).toBe("Não informada");
  });
});

describe("subcategory names", () => {
  it("names the subcategories we have", () => {
    expect(subcategoryName("GPU")).toBe("Placas de vídeo");
    expect(subcategorySingularName("GPU")).toBe("Placa de vídeo");
  });

  it("falls back to the key for one the app does not know yet", () => {
    expect(subcategoryName("CPU")).toBe("CPU");
    expect(subcategorySingularName("CPU")).toBe("CPU");
  });
});
