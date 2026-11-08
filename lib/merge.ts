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

export function starterShortfall(need: StarterCounts, have: StarterCounts): StarterCounts {
  return {
    chick: Math.max(0, need.chick - have.chick),
    bunny: Math.max(0, need.bunny - have.bunny),
    cat: Math.max(0, need.cat - have.cat),
  };
}

export function canAfford(need: StarterCounts, have: StarterCounts): boolean {
  return totalCount(starterShortfall(need, have)) === 0;
}

function peakStrain(need: StarterCounts, have: StarterCounts): number {
  let peak = 0;
  for (const id of STARTER_IDS) {
    if (need[id] <= 0) continue;
    if (have[id] <= 0) return Number.POSITIVE_INFINITY;
    peak = Math.max(peak, need[id] / have[id]);
  }
  return peak;
}

export type StarterOption = {
  counts: StarterCounts;
  affordable: boolean;
  shortfall: StarterCounts;
  path: PathCounts | null;
  uses: string[];
  tree: BuildStep | null;
};

export type BuildStep = {
  creatureId: string;
  counts: StarterCounts;
  left: BuildStep | null;
  right: BuildStep | null;
  owned?: boolean;
};

function cheaperCost(a: StarterCounts, b: StarterCounts, have: StarterCounts): number {
  const extra = totalCount(starterShortfall(a, have)) - totalCount(starterShortfall(b, have));
  if (extra !== 0) return extra;
  const strain = peakStrain(a, have) - peakStrain(b, have);
  if (strain !== 0) return strain;
  return totalCount(a) - totalCount(b);
}

type PricedTree = { cost: StarterCounts; step: BuildStep; uses: string[] };

function covered(node: BuildStep): PricedTree {
  return {
    cost: emptyCounts(),
    uses: [node.creatureId],
    step: {
      creatureId: node.creatureId,
      counts: emptyCounts(),
      left: null,
      right: null,
      owned: true,
    },
  };
}

function joined(node: BuildStep, left: PricedTree, right: PricedTree): PricedTree {
  return {
    cost: addCounts(left.cost, right.cost),
    uses: [...left.uses, ...right.uses],
    step: {
      creatureId: node.creatureId,
      counts: addCounts(left.cost, right.cost),
      left: left.step,
      right: right.step,
    },
  };
}

function priceGreedy(step: BuildStep, owned: string[]): PricedTree {
  const counts = new Map<string, number>();
  for (const id of owned) counts.set(id, (counts.get(id) ?? 0) + 1);

  function walk(node: BuildStep): PricedTree {
    const available = counts.get(node.creatureId) ?? 0;
    if (available > 0 && !isStarter(node.creatureId)) {
      counts.set(node.creatureId, available - 1);
      return covered(node);
    }
    if (!node.left || !node.right) return { cost: node.counts, uses: [], step: node };
    if (totalCount(node.left.counts) >= totalCount(node.right.counts)) {
      return joined(node, walk(node.left), walk(node.right));
    }
    const right = walk(node.right);
    return joined(node, walk(node.left), right);
  }

  return walk(step);
}

export function priceTree(
  step: BuildStep,
  owned: string[],
  have: StarterCounts,
  memo: Map<string, PricedTree> = new Map(),
): PricedTree {
  if (owned.length > 8) return priceGreedy(step, owned);

  function solve(node: BuildStep, items: string[]): PricedTree {
    const bagKey = [...items].sort().join("|");
    const memoKey = `${node.creatureId}|${countKey(node.counts)}|${bagKey}`;
    const hit = memo.get(memoKey);
    if (hit) return hit;

    if (items.includes(node.creatureId) && !isStarter(node.creatureId)) {
      const quote = covered(node);
      memo.set(memoKey, quote);
      return quote;
    }

    let best: PricedTree | null = null;
    const consider = (quote: PricedTree) => {
      if (!best || cheaperCost(quote.cost, best.cost, have) < 0) best = quote;
    };

    if (!node.left || !node.right) {
      consider({ cost: node.counts, uses: [], step: node });
    } else if (items.length === 0) {
      consider(joined(node, solve(node.left, []), solve(node.right, [])));
    } else {
      const masks = 1 << items.length;
      for (let mask = 0; mask < masks; mask += 1) {
        const leftBag: string[] = [];
        const rightBag: string[] = [];
        for (let index = 0; index < items.length; index += 1) {
          if (mask & (1 << index)) leftBag.push(items[index]);
          else rightBag.push(items[index]);
        }
        consider(joined(node, solve(node.left, leftBag), solve(node.right, rightBag)));
      }
    }

    const chosen = best ?? { cost: node.counts, uses: [], step: node };
    memo.set(memoKey, chosen);
    return chosen;
  }

  return solve(step, owned);
}

function ownedOverlap(step: BuildStep, prefer: ReadonlySet<string>): number {
  const here = prefer.has(step.creatureId) ? totalCount(step.counts) : 0;
  return here + (step.left ? ownedOverlap(step.left, prefer) : 0) + (step.right ? ownedOverlap(step.right, prefer) : 0);
}

export function buildTree(
  catalog: Catalog,
  creatureId: string,
  path: Pick<PathCounts, "parentA" | "parentB" | "counts">,
  cache: Map<string, Map<string, BuildStep>> = new Map(),
  prefer: ReadonlySet<string> = new Set(),
): BuildStep | null {
  const creatures = creatureMap(catalog.creatures);
  const recipesFor = recipesByResult(catalog.recipes);

  function options(id: string, stack: string[]): Map<string, BuildStep> | null {
    if (stack.includes(id)) return null;
    const cached = cache.get(id);
    if (cached) return cached;
    const creature = creatures.get(id);
    if (!creature) return null;
    const found = new Map<string, BuildStep>();
    if (creature.tier === 1) {
      if (!isStarter(id)) return null;
      const counts = emptyCounts();
      counts[id] = 1;
      found.set(countKey(counts), { creatureId: id, counts, left: null, right: null });
      cache.set(id, found);
      return found;
    }
    const recipes = recipesFor.get(id) ?? [];
    for (const recipe of recipes) {
      const left = options(recipe.parentA, [...stack, id]);
      const right = options(recipe.parentB, [...stack, id]);
      if (!left || !right) continue;
      for (const parentLeft of left.values()) {
        for (const parentRight of right.values()) {
          const counts = addCounts(parentLeft.counts, parentRight.counts);
          const key = countKey(counts);
          const candidate: BuildStep = {
            creatureId: id,
            counts,
            left: parentLeft,
            right: parentRight,
          };
          const previous = found.get(key);
          if (previous && (prefer.size === 0 || ownedOverlap(previous, prefer) >= ownedOverlap(candidate, prefer))) {
            continue;
          }
          found.set(key, candidate);
        }
      }
    }
    if (found.size === 0) return null;
    cache.set(id, found);
    return found;
  }

  const left = options(path.parentA, [creatureId]);
  const right = options(path.parentB, [creatureId]);
  if (!left || !right) return null;
  const target = countKey(path.counts);
  for (const parentLeft of left.values()) {
    for (const parentRight of right.values()) {
      const counts = addCounts(parentLeft.counts, parentRight.counts);
      if (countKey(counts) !== target) continue;
      return { creatureId, counts, left: parentLeft, right: parentRight };
    }
  }
  return null;
}

export function adviseStarters(
  paths: PathCounts[],
  ownCounts: StarterCounts,
  have: StarterCounts,
): StarterOption[] {
  const sources =
    paths.length > 0
      ? paths.map((path) => ({ counts: path.counts, path }))
      : [{ counts: ownCounts, path: null }];
  const options: StarterOption[] = sources.map((source) => {
    const shortfall = starterShortfall(source.counts, have);
    return {
      counts: source.counts,
      shortfall,
      affordable: totalCount(shortfall) === 0,
      path: source.path,
      uses: [],
      tree: null,
    };
  });
  return options.sort((a, b) => compareOptions(a, b, have));
}

function compareOptions(a: StarterOption, b: StarterOption, have: StarterCounts): number {
  if (a.affordable !== b.affordable) return a.affordable ? -1 : 1;
  const extra = totalCount(a.shortfall) - totalCount(b.shortfall);
  if (extra !== 0) return extra;
  const strainA = peakStrain(a.counts, have);
  const strainB = peakStrain(b.counts, have);
  if (strainA !== strainB) {
    if (!Number.isFinite(strainA)) return 1;
    if (!Number.isFinite(strainB)) return -1;
    return strainA - strainB;
  }
  return totalCount(a.counts) - totalCount(b.counts);
}

export function rankMixes(
  catalog: Catalog,
  creatureId: string,
  paths: PathCounts[],
  ownCounts: StarterCounts,
  have: StarterCounts,
  owned: string[],
): StarterOption[] {
  const usable = owned.filter((id) => {
    const creature = catalog.creatures.find((item) => item.id === id);
    return creature !== undefined && creature.tier > 1;
  });
  if (usable.length === 0) return adviseStarters(paths, ownCounts, have);
  const sources =
    paths.length > 0
      ? paths.map((path) => ({ counts: path.counts, path }))
      : [{ counts: ownCounts, path: null as PathCounts | null }];
  const cache = new Map<string, Map<string, BuildStep>>();
  const pricedTrees = new Map<string, PricedTree>();
  const prefer = new Set(usable);
  const options = sources.map((source) => {
    const tree = source.path ? buildTree(catalog, creatureId, source.path, cache, prefer) : null;
    if (!tree) {
      const shortfall = starterShortfall(source.counts, have);
      return {
        counts: source.counts,
        shortfall,
        affordable: totalCount(shortfall) === 0,
        path: source.path,
        uses: [] as string[],
        tree: null,
      };
    }
    const priced = priceTree(tree, usable, have, pricedTrees);
    const shortfall = starterShortfall(priced.cost, have);
    return {
      counts: priced.cost,
      shortfall,
      affordable: totalCount(shortfall) === 0,
      path: source.path,
      uses: priced.uses,
      tree: priced.step,
    };
  });
  return options.sort((a, b) => compareOptions(a, b, have));
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
