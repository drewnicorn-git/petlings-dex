import type { FarmId } from "@/lib/farms";

export type TierStyle = {
  tier: number;
  bg: string;
  fg: string;
};

export const TIERS: TierStyle[] = [
  { tier: 1, bg: "#e8b931", fg: "#3a2a04" },
  { tier: 2, bg: "#7dbe57", fg: "#14280c" },
  { tier: 3, bg: "#3aa89a", fg: "#042824" },
  { tier: 4, bg: "#4f86e0", fg: "#071833" },
  { tier: 5, bg: "#7d63e6", fg: "#160c36" },
  { tier: 6, bg: "#d45cae", fg: "#320818" },
  { tier: 7, bg: "#ef7d3c", fg: "#351404" },
  { tier: 8, bg: "#e15b55", fg: "#360a0c" },
  { tier: 9, bg: "#a67c52", fg: "#24160c" },
  { tier: 10, bg: "#243044", fg: "#f6e7b2" },
];

export function tierStyle(tier: number): TierStyle {
  return TIERS.find((item) => item.tier === tier) ?? TIERS[0];
}

export function starterTotal(tier: number): number {
  if (tier <= 1) return 1;
  if (tier <= 7) return 2 ** (tier - 1);
  let total = 2 ** 6;
  for (let current = 8; current <= tier; current += 1) total *= 3;
  return total;
}

export const TIER_TOTALS: Record<number, number> = {
  1: 3,
  2: 6,
  3: 21,
  4: 24,
  5: 25,
  6: 25,
  7: 23,
  8: 22,
  9: 19,
  10: 16,
};

export const SEA_TIER_TOTALS: Record<number, number> = {
  1: 3,
  2: 6,
  3: 15,
  4: 19,
  5: 19,
  6: 17,
  7: 15,
  8: 13,
  9: 11,
  10: 9,
};

export function tierTotals(farm: FarmId): Record<number, number> {
  return farm === "sea" ? SEA_TIER_TOTALS : TIER_TOTALS;
}

export function collectionTotal(farm: FarmId): number {
  const totals = tierTotals(farm);
  return TIERS.reduce((sum, tier) => sum + (totals[tier.tier] ?? 0), 0);
}

export const COLLECTION_TOTAL = collectionTotal("land");
