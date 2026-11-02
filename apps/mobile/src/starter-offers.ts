import type { MobileOffer } from "./types";

// Relative to now, because an offer older than 72 hours would not be listed as valid.
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

/**
 * Conteúdo demonstrativo para a primeira execução sem API ou cache.
 * IDs e lojas deixam explícito que os preços não representam anúncios reais.
 */
export const STARTER_OFFERS: MobileOffer[] = [
  {
    id: "demo-rtx-4060",
    productId: "demo-product-rtx-4060",
    product: { category: "GPU", vendor: "NVIDIA", model: "RTX 4060", vramGb: 8 },
    store: { name: "Demonstração", domain: "demo.saleadvisor.local" },
    effectivePriceCents: 179990,
    lowestPriceCents: 174990,
    coupon: "EXEMPLO5",
    condition: "new",
    label: "muito_boa",
    qualityScore: 86,
    scoreSummary: "Preço ilustrativo abaixo da mediana de 30 dias",
    mentionCount: 4,
    firstSeenAt: minutesAgo(8),
    lastSeenAt: minutesAgo(8),
    status: "active",
    history: {
      median30dInCents: 202000,
      lowest90dInCents: 176000,
      discountVsMedianPercent: 10.9
    },
    url: null
  },
  {
    id: "demo-rx-7600",
    productId: "demo-product-rx-7600",
    product: { category: "GPU", vendor: "AMD", model: "RX 7600", vramGb: 8 },
    store: { name: "Demonstração", domain: "demo.saleadvisor.local" },
    effectivePriceCents: 159990,
    lowestPriceCents: 154990,
    condition: "new",
    label: "excepcional",
    qualityScore: 93,
    scoreSummary: "Preço ilustrativo próximo da mínima de 90 dias",
    mentionCount: 7,
    firstSeenAt: minutesAgo(25),
    lastSeenAt: minutesAgo(25),
    status: "active",
    history: {
      median30dInCents: 193000,
      lowest90dInCents: 158000,
      discountVsMedianPercent: 17.1
    },
    url: null
  },
  {
    id: "demo-rtx-4070-super",
    productId: "demo-product-rtx-4070-super",
    product: { category: "GPU", vendor: "NVIDIA", model: "RTX 4070 Super", vramGb: 12 },
    store: { name: "Demonstração", domain: "demo.saleadvisor.local" },
    effectivePriceCents: 399990,
    lowestPriceCents: 389990,
    condition: "new",
    label: "boa",
    qualityScore: 74,
    scoreSummary: "Preço ilustrativo 8% abaixo da mediana de 30 dias",
    mentionCount: 2,
    firstSeenAt: minutesAgo(180),
    lastSeenAt: minutesAgo(180),
    status: "active",
    history: {
      median30dInCents: 430000,
      lowest90dInCents: 392000,
      discountVsMedianPercent: 7
    },
    url: null
  },
  {
    id: "demo-rx-7800-xt",
    productId: "demo-product-rx-7800-xt",
    product: { category: "GPU", vendor: "AMD", model: "RX 7800 XT", vramGb: 16 },
    store: { name: "Demonstração", domain: "demo.saleadvisor.local" },
    effectivePriceCents: 349990,
    lowestPriceCents: 339990,
    condition: "new",
    label: "muito_boa",
    qualityScore: 84,
    scoreSummary: "Preço ilustrativo abaixo da média recente",
    mentionCount: 5,
    firstSeenAt: minutesAgo(1020),
    lastSeenAt: minutesAgo(1020),
    status: "active",
    history: {
      median30dInCents: 389000,
      lowest90dInCents: 342000,
      discountVsMedianPercent: 10
    },
    url: null
  }
];
