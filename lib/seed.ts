import board from "@/data/merge-board.json";
import seaBoard from "@/data/sea-board.json";
import { FARM_STARTERS } from "@/lib/farms";
import type { Catalog, Creature, Recipe } from "@/lib/types";

export const bundledRevision = board.revision;

type BundledBoard = {
  creatures: Array<{ id: string; name: string; tier: number; locked?: boolean }>;
  recipes: Array<{
    id: string;
    parentA: string;
    parentB: string;
    parentC?: string;
    resultId: string;
  }>;
};

function toCatalog(
  source: BundledBoard,
  starters: readonly [string, string, string],
): Catalog {
  return {
    starters,
    creatures: source.creatures.map(
      (creature): Creature => ({
        id: creature.id,
        name: creature.name,
        tier: creature.tier,
        ...("locked" in creature && creature.locked ? { locked: true } : {}),
      }),
    ),
    recipes: source.recipes.map(
      (recipe): Recipe => ({
        id: recipe.id,
        parentA: recipe.parentA,
        parentB: recipe.parentB,
        ...("parentC" in recipe && typeof recipe.parentC === "string" ? { parentC: recipe.parentC } : {}),
        resultId: recipe.resultId,
      }),
    ),
  };
}

export const seedCatalog: Catalog = toCatalog(board, FARM_STARTERS.land);

export const seaCatalog: Catalog = toCatalog(seaBoard, FARM_STARTERS.sea);
