export const GPU_TAXONOMY_SEED = [
  gpu("00000000-0000-4000-8000-000000000001", "NVIDIA", "RTX 3060", 12),
  gpu("00000000-0000-4000-8000-000000000002", "NVIDIA", "RTX 4060", 8),
  gpu("00000000-0000-4000-8000-000000000003", "NVIDIA", "RTX 4060 Ti", 8),
  gpu("00000000-0000-4000-8000-000000000004", "NVIDIA", "RTX 4070", 12),
  gpu("00000000-0000-4000-8000-000000000005", "NVIDIA", "RTX 4070 Super", 12),
  gpu("00000000-0000-4000-8000-000000000006", "AMD", "RX 6600", 8),
  gpu("00000000-0000-4000-8000-000000000007", "AMD", "RX 7600", 8),
  gpu("00000000-0000-4000-8000-000000000008", "AMD", "RX 7700 XT", 12),
  gpu("00000000-0000-4000-8000-000000000009", "AMD", "RX 7800 XT", 16)
] as const;

function gpu(id: string, vendor: "NVIDIA" | "AMD", model: string, vramGb: number) {
  return {
    id,
    canonicalKey: `${vendor.toLowerCase()}-${model.toLowerCase().replace(/\s+/g, "-")}-${vramGb}gb`,
    vendor,
    model,
    vramGb
  };
}
