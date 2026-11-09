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
  parentB: string;
  parentC?: string;
  resultId: string;
};

export type Catalog = {
  creatures: Creature[];
  recipes: Recipe[];
  starters: readonly [string, string, string];
};

export type BoardToken = {
  id: string;
  creatureId: string;
  x: number;
  y: number;
};

export const STARTER_IDS = ["chick", "bunny", "cat"] as const;

export type StarterId = string;

export type StarterCounts = Record<string, number>;

export { STARTER_NAMES } from "@/lib/farms";
