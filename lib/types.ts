export type Creature = {
  id: string;
  name: string;
  tier: number;
  locked?: boolean;
};

export type CreaturePatch = {
  name?: string;
  tier?: number;
};

export type Recipe = {
  id: string;
  parentA: string;
  resultId: string;
  parentB: string;
};

export type Catalog = {
  creatures: Creature[];
  recipes: Recipe[];
};

export type BoardToken = {
  id: string;
  creatureId: string;
  x: number;
  y: number;
};

export const STARTER_IDS = ["chick", "bunny", "cat"] as const;

export type StarterId = (typeof STARTER_IDS)[number];

export type StarterCounts = Record<StarterId, number>;

export const STARTER_NAMES: Record<StarterId, string> = {
  chick: "Chick",
  bunny: "Bunny",
  cat: "Cat",
};
