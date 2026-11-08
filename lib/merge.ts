import { starterTotal } from "@/lib/tiers";
import {
  STARTER_IDS,
  STARTER_NAMES,
  type Catalog,
  type Creature,
  type Recipe,
  type StarterCounts,
  type StarterId,
} from "@/lib/types";

export function isStarter(id: string): id is StarterId {
  return (STARTER_IDS as readonly string[]).includes(id);
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function slugify(name: string): string {
  const base = normalizeName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "creature";
}

export function uniqueCreatureId(name: string, ids: string[]): string {
  const base = slugify(name);
  if (!ids.includes(base)) return base;
  let n = 2;
  while (ids.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export function pairKey(a: string, b: string): string {
  return a <= b ? `${a}|${b}` : `${b}|${a}`;
}

export function creatureMap(creatures: Creature[]): Map<string, Creature> {
  return new Map(creatures.map((creature) => [creature.id, creature]));
}

export function creatureName(catalog: Catalog, id: string): string {
  return catalog.creatures.find((creature) => creature.id === id)?.name ?? "Unknown";
}

export function findByName(creatures: Creature[], name: string): Creature | undefined {
  const key = normalizeName(name).toLowerCase();
  return creatures.find((creature) => creature.name.toLowerCase() === key);
}

export function sortCreatures(creatures: Creature[]): Creature[] {
  return [...creatures].sort(
    (a, b) => a.tier - b.tier || a.name.localeCompare(b.name),
  );
}

export function findRecipe(
  recipes: Recipe[],
  a: string,
  b: string,
): Recipe | undefined {
  const key = pairKey(a, b);
  return recipes.find((recipe) => pairKey(recipe.parentA, recipe.parentB) === key);
}

export function missingPartners(catalog: Catalog, creatureId: string): Creature[] {
  const creature = creatureMap(catalog.creatures).get(creatureId);
  if (!creature || creature.tier >= 10) return [];
  return catalog.creatures
    .filter(
      (other) =>
        other.tier === creature.tier && !findRecipe(catalog.recipes, creature.id, other.id),
    )
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function emptyCounts(): StarterCounts {
  return { chick: 0, bunny: 0, cat: 0 };
}

export function addCounts(a: StarterCounts, b: StarterCounts): StarterCounts {
  return {
    chick: a.chick + b.chick,
    bunny: a.bunny + b.bunny,
    cat: a.cat + b.cat,
  };
}

export function totalCount(counts: StarterCounts): number {
  return counts.chick + counts.bunny + counts.cat;
}

export type MergeAttempt =
  | { ok: true; resultId: string }
  | { ok: false; reason: "same-tier" | "max-tier" | "unknown" };

export function attemptMerge(
  catalog: Catalog,
  aId: string,
  bId: string,
): MergeAttempt {
  const map = creatureMap(catalog.creatures);
  const a = map.get(aId);
  const b = map.get(bId);
  if (!a || !b || a.tier !== b.tier) return { ok: false, reason: "same-tier" };
  if (a.tier >= 10) return { ok: false, reason: "max-tier" };
  const recipe = findRecipe(catalog.recipes, aId, bId);
  if (!recipe) return { ok: false, reason: "unknown" };
  return { ok: true, resultId: recipe.resultId };
}

function dependsOn(
  catalog: Catalog,
  id: string,
  target: string,
  ignoreRecipeId: string | undefined,
  seen: Set<string>,
): boolean {
  if (id === target) return true;
  if (seen.has(id)) return false;
  seen.add(id);
  const recipes = catalog.recipes.filter(
    (recipe) => recipe.resultId === id && recipe.id !== ignoreRecipeId,
  );
  return recipes.some(
    (recipe) =>
      dependsOn(catalog, recipe.parentA, target, ignoreRecipeId, seen) ||
      dependsOn(catalog, recipe.parentB, target, ignoreRecipeId, seen),
  );
}

export function validateRecipe(
  catalog: Catalog,
  parentA: string,
  parentB: string,
  resultId: string,
  ignoreRecipeId?: string,
): string | null {
  const map = creatureMap(catalog.creatures);
  const a = map.get(parentA);
  const b = map.get(parentB);
  const result = map.get(resultId);
  if (!a || !b || !result) return "Pick creatures that are in the list.";
  if (a.tier !== b.tier) {
    return "Those two are different tiers. A merge needs the same tier.";
  }
  if (a.tier >= 10) {
    return "Tier 10 creatures have no higher tier to merge into.";
  }
  if (result.tier !== a.tier + 1) {
    return `The result has to be tier ${a.tier + 1}.`;
  }
  const existing = catalog.recipes.find(
    (recipe) =>
      recipe.id !== ignoreRecipeId &&
      pairKey(recipe.parentA, recipe.parentB) === pairKey(parentA, parentB),
  );
  if (existing) {
    return `That pair already makes ${creatureName(catalog, existing.resultId)}.`;
  }
  if (
    dependsOn(catalog, parentA, resultId, ignoreRecipeId, new Set()) ||
    dependsOn(catalog, parentB, resultId, ignoreRecipeId, new Set())
  ) {
    return "That combo loops back on itself.";
  }
  return null;
}

export function validateCreatureDraft(
  creatures: Creature[],
  name: string,
  tier: number,
  ignoreId?: string,
): string | null {
  const cleaned = normalizeName(name);
  if (!cleaned) return "Give the creature a name.";
  if (!Number.isInteger(tier) || tier < 1 || tier > 10) {
    return "Tier must be from 1 to 10.";
  }
  const existing = findByName(creatures, cleaned);
  if (existing && existing.id !== ignoreId) {
    return `${existing.name} is already in the list.`;
  }
  const current = ignoreId
    ? creatures.find((creature) => creature.id === ignoreId)
    : undefined;
  if (current?.locked) return null;
  if (tier === 1) return "Only Chick, Bunny, and Cat can be tier 1.";
  return null;
}

export function validateTierChange(
  catalog: Catalog,
  id: string,
  nextTier: number,
): string | null {
  const map = creatureMap(catalog.creatures);
  const creature = map.get(id);
  if (!creature) return "That creature is not in the list.";
  if (creature.locked && nextTier !== 1) {
    return `${creature.name} stays at tier 1.`;
  }
  const nameError = validateCreatureDraft(
    catalog.creatures,
    creature.name,
    nextTier,
    id,
  );
  if (nameError) return nameError;
  for (const recipe of catalog.recipes) {
    const involved =
      recipe.parentA === id || recipe.parentB === id || recipe.resultId === id;
    if (!involved) continue;
    const parentA = map.get(recipe.parentA);
    const parentB = map.get(recipe.parentB);
    const result = map.get(recipe.resultId);
    if (!parentA || !parentB || !result) continue;
    const tierA = recipe.parentA === id ? nextTier : parentA.tier;
    const tierB = recipe.parentB === id ? nextTier : parentB.tier;
    const tierResult = recipe.resultId === id ? nextTier : result.tier;
    if (tierA !== tierB) {
      return "Changing that tier would put its combo parents on different tiers.";
    }
    if (tierResult !== tierA + 1) {
      return "Changing that tier would break the next-tier rule on a combo.";
    }
  }
  return null;
}

export type PathCounts = {
  recipeId: string;
  parentA: string;
  parentB: string;
  counts: StarterCounts;
};

export type Breakdown =
  | {
      status: "ok";
      total: number;
      counts: StarterCounts;
      paths: PathCounts[];
    }
  | { status: "missing" | "cycle" | "not-starter"; creatureId: string };

type CountResult =
  | { ok: true; counts: StarterCounts[] }
  | { ok: false; error: "missing" | "cycle" | "not-starter"; creatureId: string };

function countKey(counts: StarterCounts): string {
  return `${counts.chick}:${counts.bunny}:${counts.cat}`;
}

function recipesByResult(recipes: Recipe[]): Map<string, Recipe[]> {
  const map = new Map<string, Recipe[]>();
  for (const recipe of recipes) {
    const list = map.get(recipe.resultId);
    if (list) list.push(recipe);
    else map.set(recipe.resultId, [recipe]);
  }
  return map;
}

export function disassemble(creatureId: string, catalog: Catalog): Breakdown {
  const creatures = creatureMap(catalog.creatures);
  const creature = creatures.get(creatureId);
  if (!creature) return { status: "missing", creatureId };
  if (isStarter(creatureId)) {
    const counts = emptyCounts();
    counts[creatureId] = 1;
    return { status: "ok", total: 1, counts, paths: [] };
  }

  const recipesFor = recipesByResult(catalog.recipes);
  const cache = new Map<string, StarterCounts[]>();

  function parentCounts(id: string, stack: string[]): CountResult {
    if (stack.includes(id)) return { ok: false, error: "cycle", creatureId: id };
    const cached = cache.get(id);
    if (cached) return { ok: true, counts: cached };
    const current = creatures.get(id);
    if (!current) return { ok: false, error: "missing", creatureId: id };
    if (current.tier === 1) {
      if (!isStarter(id)) return { ok: false, error: "not-starter", creatureId: id };
      const counts = emptyCounts();
      counts[id] = 1;
      const only = [counts];
      cache.set(id, only);
      return { ok: true, counts: only };
    }
    const recipes = recipesFor.get(id) ?? [];
    if (recipes.length === 0) return { ok: false, error: "missing", creatureId: id };
    const seen = new Set<string>();
    const counts: StarterCounts[] = [];
    let failure: CountResult | null = null;
    for (const recipe of recipes) {
      const left = parentCounts(recipe.parentA, [...stack, id]);
      if (!left.ok) {
        failure ??= left;
        continue;
      }
      const right = parentCounts(recipe.parentB, [...stack, id]);
      if (!right.ok) {
        failure ??= right;
        continue;
      }
      for (const parentLeft of left.counts) {
        for (const parentRight of right.counts) {
          const combined = addCounts(parentLeft, parentRight);
          const signature = countKey(combined);
          if (seen.has(signature)) continue;
          seen.add(signature);
          counts.push(combined);
        }
      }
    }
    if (counts.length === 0) return failure ?? { ok: false, error: "missing", creatureId: id };
    cache.set(id, counts);
    return { ok: true, counts };
  }

  const recipes = recipesFor.get(creatureId) ?? [];
  if (recipes.length === 0) return { status: "missing", creatureId };
  const paths: PathCounts[] = [];
  let failure: CountResult | null = null;
  for (const recipe of recipes) {
    const left = parentCounts(recipe.parentA, [creatureId]);
    if (!left.ok) {
      failure ??= left;
      continue;
    }
    const right = parentCounts(recipe.parentB, [creatureId]);
    if (!right.ok) {
      failure ??= right;
      continue;
    }
    const seen = new Set<string>();
    for (const parentLeft of left.counts) {
      for (const parentRight of right.counts) {
        const counts = addCounts(parentLeft, parentRight);
        const signature = countKey(counts);
        if (seen.has(signature)) continue;
        seen.add(signature);
        paths.push({
          recipeId: recipe.id,
          parentA: recipe.parentA,
          parentB: recipe.parentB,
          counts,
        });
      }
    }
  }
  if (paths.length === 0) {
    if (!failure || failure.ok) return { status: "missing", creatureId };
    return { status: failure.error, creatureId: failure.creatureId };
  }
  const counts = paths[0]?.counts ?? emptyCounts();
  return {
    status: "ok",
    total: totalCount(counts),
    counts,
    paths,
  };
}

export function expectedStarterTotal(tier: number): number {
  return starterTotal(tier);
}

export function starterLabel(id: StarterId): string {
  return STARTER_NAMES[id];
}
