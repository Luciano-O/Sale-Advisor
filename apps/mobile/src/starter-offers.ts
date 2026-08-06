import type { MobileOffer } from "./types";

const observedAt = "2026-08-06T12:00:00.000Z";

/**
 * Conteúdo demonstrativo para a primeira execução sem API ou cache.
 * IDs e lojas deixam explícito que os preços não representam anúncios reais.
 */
export const STARTER_OFFERS: MobileOffer[] = [
  {
    id: "demo-rtx-4060",
    productId: "demo-product-rtx-4060",
    product: { category: "GPU", vendor: "NVIDIA", model: "RTX 4060", vramGb: 8 },
    store: { name: "Oferta demonstrativa", domain: "demo.saleadvisor.local" },
    effectivePriceCents: 179990,
    lowestPriceCents: 174990,
    coupon: "EXEMPLO5",
    condition: "novo (demonstração)",
    label: "muito_boa",
    qualityScore: 86,
    scoreSummary: "Preço ilustrativo abaixo da mediana de 30 dias",
    mentionCount: 4,
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
    url: null
  },
  {
    id: "demo-rx-7600",
    productId: "demo-product-rx-7600",
    product: { category: "GPU", vendor: "AMD", model: "RX 7600", vramGb: 8 },
    store: { name: "Oferta demonstrativa", domain: "demo.saleadvisor.local" },
    effectivePriceCents: 159990,
    lowestPriceCents: 154990,
    condition: "novo (demonstração)",
    label: "excepcional",
    qualityScore: 93,
    scoreSummary: "Preço ilustrativo próximo da mínima de 90 dias",
    mentionCount: 7,
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
    url: null
  },
  {
    id: "demo-rtx-4070-super",
    productId: "demo-product-rtx-4070-super",
    product: { category: "GPU", vendor: "NVIDIA", model: "RTX 4070 Super", vramGb: 12 },
    store: { name: "Oferta demonstrativa", domain: "demo.saleadvisor.local" },
    effectivePriceCents: 399990,
    lowestPriceCents: 389990,
    condition: "novo (demonstração)",
    label: "boa",
    qualityScore: 74,
    scoreSummary: "Preço ilustrativo 8% abaixo da mediana de 30 dias",
    mentionCount: 2,
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
    url: null
  },
  {
    id: "demo-rx-7800-xt",
    productId: "demo-product-rx-7800-xt",
    product: { category: "GPU", vendor: "AMD", model: "RX 7800 XT", vramGb: 16 },
    store: { name: "Oferta demonstrativa", domain: "demo.saleadvisor.local" },
    effectivePriceCents: 349990,
    lowestPriceCents: 339990,
    condition: "novo (demonstração)",
    label: "muito_boa",
    qualityScore: 84,
    scoreSummary: "Preço ilustrativo abaixo da média recente",
    mentionCount: 5,
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
    url: null
  }
];
