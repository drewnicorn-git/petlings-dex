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
  return 2 ** (tier - 1);
}
