import { colors } from "./theme";
import type { MobileOffer, ScoreLabel } from "./types";

export const LABEL_RAMP: readonly ScoreLabel[] = ["normal", "boa", "muito_boa", "excepcional"];

const LABEL_NAMES: Record<ScoreLabel, string> = {
  normal: "Normal",
  boa: "Boa",
  muito_boa: "Muito boa",
  excepcional: "Excepcional"
};

const LABEL_COLORS: Record<ScoreLabel, string> = {
  normal: colors.labelNormal,
  boa: colors.labelBoa,
  muito_boa: colors.labelMuitoBoa,
  excepcional: colors.labelExcepcional
};

export const labelName = (label: ScoreLabel) => LABEL_NAMES[label];

export const labelColor = (label: ScoreLabel) => LABEL_COLORS[label];

export const labelTextColor = (label: ScoreLabel) =>
  label === "muito_boa" ? colors.surface : colors.ink;

export function offerName(product: Pick<MobileOffer["product"], "model" | "vramGb">): string {
  return product.vramGb ? `${product.model} ${product.vramGb}GB` : product.model;
}

const CONDITION_NAMES: Record<string, string> = {
  new: "Novo",
  used: "Usado",
  open_box: "Caixa aberta"
};

export const conditionName = (condition: string | undefined) =>
  (condition ? CONDITION_NAMES[condition] : undefined) ?? "Não informada";

const SUBCATEGORY_NAMES: Record<string, { plural: string; singular: string }> = {
  GPU: { plural: "Placas de vídeo", singular: "Placa de vídeo" }
};

export const subcategoryName = (key: string) => SUBCATEGORY_NAMES[key]?.plural ?? key;

export const subcategorySingularName = (key: string) => SUBCATEGORY_NAMES[key]?.singular ?? key;
