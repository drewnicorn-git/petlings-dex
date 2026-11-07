import board from "@/data/merge-board.json";
import { readAttributes } from "@/lib/attributes";
import type { Catalog, Creature, Recipe } from "@/lib/types";

type RawCreature = {
  id: string;
  name: string;
  tier: number;
  locked?: boolean;
  note?: string;
};

function toCreature(raw: RawCreature): Creature {
  const attributes = readAttributes(raw, raw.name);
  if (!attributes.ok) throw new Error(attributes.error);
  return {
    id: raw.id,
    name: raw.name,
    tier: raw.tier,
    ...(raw.locked ? { locked: true } : {}),
    ...(raw.note ? { note: raw.note } : {}),
    ...attributes.value,
  };
}

export const bundledRevision = board.revision;

export const seedCatalog: Catalog = {
  creatures: board.creatures.map((creature) => toCreature(creature)),
  recipes: board.recipes.map(
    (recipe): Recipe => ({
      id: recipe.id,
      parentA: recipe.parentA,
      parentB: recipe.parentB,
      resultId: recipe.resultId,
    }),
  ),
};
