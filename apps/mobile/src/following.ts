import { sortOffers, visibleOffers } from "./feed";
import type { MobileOffer, ScoreLabel, SubcategoryFollow } from "./types";

export function subcategoryStatusLabel(
  offers: readonly MobileOffer[],
  key: string,
  now: Date
): string {
  const count = visibleOffers(offers, { now, category: key }).length;
  if (count === 0) return "Nenhuma oferta válida agora";
  return count === 1 ? "1 oferta válida agora" : `${count} ofertas válidas agora`;
}

export function subcategoryModeLabel({ mode, products }: SubcategoryFollow): string {
  if (mode === "inteira") return "Subcategoria inteira · ofertas boas ou melhores";
  if (products.length === 0) return "Nenhum produto";
  return products.length === 1 ? "1 produto" : `${products.length} produtos`;
}

export interface ProductStatus {
  label: ScoreLabel;
  discountPercent: number | null;
}

/** The best valid offer of a subcategory; null while we are waiting for one. */
export function subcategoryStatus(
  offers: readonly MobileOffer[],
  key: string,
  now: Date
): ProductStatus | null {
  const [best] = sortOffers(visibleOffers(offers, { now, category: key }), "discount");
  return best ? { label: best.label, discountPercent: best.history.discountVsMedianPercent } : null;
}

/** The best valid offer of a product; null while we are waiting for one. */
export function productStatus(
  offers: readonly MobileOffer[],
  model: string,
  now: Date
): ProductStatus | null {
  const [best] = sortOffers(visibleOffers(offers, { now, model }), "discount");
  return best ? { label: best.label, discountPercent: best.history.discountVsMedianPercent } : null;
}
