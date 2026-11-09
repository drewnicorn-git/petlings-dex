import board from "@/data/merge-board.json";
import type { Catalog, Creature, Recipe } from "@/lib/types";

export const bundledRevision = board.revision;

export const seedCatalog: Catalog = {
  creatures: board.creatures.map(
    (creature): Creature => ({
      id: creature.id,
      name: creature.name,
      tier: creature.tier,
      ...(creature.locked ? { locked: true } : {}),
    }),
  ),
  recipes: board.recipes.map(
    (recipe): Recipe => ({
      id: recipe.id,
      parentA: recipe.parentA,
      parentB: recipe.parentB,
      ...("parentC" in recipe && typeof recipe.parentC === "string" ? { parentC: recipe.parentC } : {}),
      resultId: recipe.resultId,
    }),
  ),
};
