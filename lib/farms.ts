export type FarmId = "land" | "sea";

export const FARM_IDS: FarmId[] = ["land", "sea"];

export const FARM_STARTERS: Record<FarmId, readonly [string, string, string]> = {
  land: ["chick", "bunny", "cat"],
  sea: ["clownfish", "seahorse", "crab"],
};

export const ALL_STARTER_IDS = new Set<string>([
  ...FARM_STARTERS.land,
  ...FARM_STARTERS.sea,
]);

export const STARTER_NAMES: Record<string, string> = {
  chick: "Chick",
  bunny: "Bunny",
  cat: "Cat",
  clownfish: "Clownfish",
  seahorse: "Seahorse",
  crab: "Crab",
};

export function starterListLabel(starters: readonly string[]): string {
  return starters.map((id) => STARTER_NAMES[id] ?? id).join(", ");
}

export function storageKey(farm: FarmId, kind: "board" | "stock" | "owned"): string {
  if (farm === "land") {
    if (kind === "board") return "petlings-merge-board-v1";
    if (kind === "stock") return "petlings-starter-stock";
    return "petlings-owned-creatures";
  }
  if (kind === "board") return "petlings-merge-board-sea-v1";
  if (kind === "stock") return "petlings-starter-stock-sea";
  return "petlings-owned-creatures-sea";
}
