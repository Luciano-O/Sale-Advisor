import type { CanonicalGpuProduct, GpuVendor } from "./types.js";

interface GpuDefinition {
  id: string;
  vendor: GpuVendor;
  model: string;
  pattern: RegExp;
}

const GPU_TAXONOMY: GpuDefinition[] = [
  gpu("nvidia-rtx-4070-super", "NVIDIA", "RTX 4070 Super", /\brtx\s*4070\s*super\b/i),
  gpu("nvidia-rtx-4070", "NVIDIA", "RTX 4070", /\brtx\s*4070\b(?!\s*super)/i),
  gpu("nvidia-rtx-4060-ti", "NVIDIA", "RTX 4060 Ti", /\brtx\s*4060\s*ti\b/i),
  gpu("nvidia-rtx-4060", "NVIDIA", "RTX 4060", /\brtx\s*4060\b(?!\s*ti)/i),
  gpu("nvidia-rtx-3060", "NVIDIA", "RTX 3060", /\brtx\s*3060\b/i),
  gpu("amd-rx-7800-xt", "AMD", "RX 7800 XT", /\brx\s*7800\s*xt\b/i),
  gpu("amd-rx-7700-xt", "AMD", "RX 7700 XT", /\brx\s*7700\s*xt\b/i),
  gpu("amd-rx-7600", "AMD", "RX 7600", /\brx\s*7600\b/i),
  gpu("amd-rx-6600", "AMD", "RX 6600", /\brx\s*6600\b/i)
];

export function identifyGpuProduct(text: string): CanonicalGpuProduct | null {
  const match = GPU_TAXONOMY.find((product) => product.pattern.test(text));

  if (!match) {
    return null;
  }

  const vramGb = extractVram(text);
  return {
    id: `${match.id}-${vramGb === null ? "unknown-vram" : `${vramGb}gb`}`,
    vendor: match.vendor,
    model: match.model,
    vramGb
  };
}

function extractVram(text: string): number | null {
  const match = text.match(/\b(4|6|8|10|12|16|20|24)\s*gb\b/i);
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

function gpu(id: string, vendor: GpuVendor, model: string, pattern: RegExp): GpuDefinition {
  return { id, vendor, model, pattern };
}
