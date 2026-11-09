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

function ownedOverlap(
  step: BuildStep,
  prefer: ReadonlySet<string>,
  memo: WeakMap<BuildStep, number>,
): number {
  const cached = memo.get(step);
  if (cached !== undefined) return cached;
  const here = prefer.has(step.creatureId) ? totalCount(step.counts) : 0;
  const score =
    here +
    (step.left ? ownedOverlap(step.left, prefer, memo) : 0) +
    (step.right ? ownedOverlap(step.right, prefer, memo) : 0);
  memo.set(step, score);
  return score;
}

const builtTrees = new WeakMap<Catalog, Map<string, Map<string, Map<string, BuildStep>>>>();

function treeCacheFor(catalog: Catalog, prefer: ReadonlySet<string>): Map<string, Map<string, BuildStep>> {
  const key = [...prefer].sort().join("\0");
  let byPrefer = builtTrees.get(catalog);
  if (!byPrefer) {
    byPrefer = new Map();
    builtTrees.set(catalog, byPrefer);
  }
  let cache = byPrefer.get(key);
  if (!cache) {
    cache = new Map();
    byPrefer.set(key, cache);
  }
  return cache;
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
  const overlapMemo = new WeakMap<BuildStep, number>();

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
          if (
            previous &&
            (prefer.size === 0 ||
              ownedOverlap(previous, prefer, overlapMemo) >= ownedOverlap(candidate, prefer, overlapMemo))
          ) {
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
  for (const parentLeft of left.values()) {
    const complement = countKey({
      chick: path.counts.chick - parentLeft.counts.chick,
      bunny: path.counts.bunny - parentLeft.counts.bunny,
      cat: path.counts.cat - parentLeft.counts.cat,
    });
    const parentRight = right.get(complement);
    if (!parentRight) continue;
    return {
      creatureId,
      counts: path.counts,
      left: parentLeft,
      right: parentRight,
    };
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
      : [{ counts: ownCounts, path: null as PathCounts | null }];
  const best = new Map<string, StarterOption>();
  for (const source of sources) {
    const shortfall = starterShortfall(source.counts, have);
    const option: StarterOption = {
      counts: source.counts,
      shortfall,
      affordable: totalCount(shortfall) === 0,
      path: source.path,
      uses: [],
      tree: null,
    };
    const key = source.path?.recipeId ?? "*";
    const previous = best.get(key);
    if (!previous || compareOptions(option, previous, have) < 0) best.set(key, option);
  }
  return [...best.values()].sort((a, b) => compareOptions(a, b, have));
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

function countsBeat(next: StarterCounts, current: StarterCounts, have: StarterCounts): boolean {
  const nextShort = totalCount(starterShortfall(next, have));
  const currentShort = totalCount(starterShortfall(current, have));
  const nextAffordable = nextShort === 0;
  const currentAffordable = currentShort === 0;
  if (nextAffordable !== currentAffordable) return nextAffordable;
  if (nextShort !== currentShort) return nextShort < currentShort;
  const nextStrain = peakStrain(next, have);
  const currentStrain = peakStrain(current, have);
  if (nextStrain !== currentStrain) {
    if (!Number.isFinite(nextStrain)) return false;
    if (!Number.isFinite(currentStrain)) return true;
    return nextStrain < currentStrain;
  }
  return totalCount(next) < totalCount(current);
}

type SplitWitness = {
  parentA: string;
  parentB: string;
  left: number;
  right: number;
  leftBag: string;
  rightBag: string;
};

const signatureCache = new WeakMap<Catalog, Map<string, number[]>>();
const rawWitnessCache = new WeakMap<Catalog, Map<string, SplitWitness>>();
const placementCache = new WeakMap<Catalog, Map<string, number[]>>();
const placementWitnessCache = new WeakMap<Catalog, Map<string, SplitWitness>>();
const residualCache = new WeakMap<Catalog, Map<string, ResidualList>>();
const descendantCache = new WeakMap<Catalog, Map<string, Set<string>>>();
const recipeIndexCache = new WeakMap<Catalog, Map<string, Recipe[]>>();

type ResidualList = { sums: number[]; witnesses: SplitWitness[] };

function bagKey(bag: readonly string[]): string {
  return [...bag].sort().join("\0");
}

function recipeIndex(catalog: Catalog): Map<string, Recipe[]> {
  let index = recipeIndexCache.get(catalog);
  if (!index) {
    index = recipesByResult(catalog.recipes);
    recipeIndexCache.set(catalog, index);
  }
  return index;
}

function rememberSignatures(
  catalog: Catalog,
  signatures: Map<string, number[]>,
  witnesses: Map<string, SplitWitness>,
) {
  let saved = signatureCache.get(catalog);
  if (!saved) {
    saved = new Map();
    signatureCache.set(catalog, saved);
  }
  for (const [id, list] of signatures) if (!saved.has(id)) saved.set(id, list);
  let savedWitness = rawWitnessCache.get(catalog);
  if (!savedWitness) {
    savedWitness = new Map();
    rawWitnessCache.set(catalog, savedWitness);
  }
  for (const [key, witness] of witnesses) if (!savedWitness.has(key)) savedWitness.set(key, witness);
}

function signatureList(catalog: Catalog, id: string): number[] {
  const saved = signatureCache.get(catalog)?.get(id);
  if (saved) return saved;
  if (isStarter(id)) {
    const counts = emptyCounts();
    counts[id] = 1;
    const only = [packCounts(counts)];
    let map = signatureCache.get(catalog);
    if (!map) {
      map = new Map();
      signatureCache.set(catalog, map);
    }
    map.set(id, only);
    return only;
  }
  disassemble(id, catalog);
  return signatureCache.get(catalog)?.get(id) ?? [];
}

function descendantsOf(catalog: Catalog, id: string): Set<string> {
  let map = descendantCache.get(catalog);
  if (!map) {
    map = new Map();
    descendantCache.set(catalog, map);
  }
  const saved = map.get(id);
  if (saved) return saved;
  const found = new Set<string>();
  map.set(id, found);
  for (const recipe of recipeIndex(catalog).get(id) ?? []) {
    found.add(recipe.parentA);
    found.add(recipe.parentB);
    for (const child of descendantsOf(catalog, recipe.parentA)) found.add(child);
    for (const child of descendantsOf(catalog, recipe.parentB)) found.add(child);
  }
  return found;
}

function placementMap(catalog: Catalog): Map<string, number[]> {
  let map = placementCache.get(catalog);
  if (!map) {
    map = new Map();
    placementCache.set(catalog, map);
  }
  return map;
}

function placementWitnesses(catalog: Catalog): Map<string, SplitWitness> {
  let map = placementWitnessCache.get(catalog);
  if (!map) {
    map = new Map();
    placementWitnessCache.set(catalog, map);
  }
  return map;
}

function placements(catalog: Catalog, id: string, bag: readonly string[]): number[] {
  const key = `${id}\n${bagKey(bag)}`;
  const cache = placementMap(catalog);
  const saved = cache.get(key);
  if (saved) return saved;
  if (bag.length === 1 && bag[0] === id && !isStarter(id)) {
    const cover = [0];
    cache.set(key, cover);
    return cover;
  }
  const empty: number[] = [];
  if (isStarter(id) || bag.includes(id)) {
    cache.set(key, empty);
    return empty;
  }
  const descendants = descendantsOf(catalog, id);
  if (!bag.every((item) => descendants.has(item))) {
    cache.set(key, empty);
    return empty;
  }
  const found = new Map<number, SplitWitness>();
  const masks = 1 << bag.length;
  for (const recipe of recipeIndex(catalog).get(id) ?? []) {
    for (let mask = 0; mask < masks; mask += 1) {
      const leftBag: string[] = [];
      const rightBag: string[] = [];
      for (let index = 0; index < bag.length; index += 1) {
        if (mask & (1 << index)) leftBag.push(bag[index]);
        else rightBag.push(bag[index]);
      }
      const lefts = leftBag.length ? placements(catalog, recipe.parentA, leftBag) : signatureList(catalog, recipe.parentA);
      const rights = rightBag.length
        ? placements(catalog, recipe.parentB, rightBag)
        : signatureList(catalog, recipe.parentB);
      if (lefts.length === 0 || rights.length === 0) continue;
      const leftKey = bagKey(leftBag);
      const rightKey = bagKey(rightBag);
      for (const left of lefts) {
        for (const right of rights) {
          const sum = left + right;
          if (found.has(sum)) continue;
          found.set(sum, {
            parentA: recipe.parentA,
            parentB: recipe.parentB,
            left,
            right,
            leftBag: leftKey,
            rightBag: rightKey,
          });
        }
      }
    }
  }
  const sums = [...found.keys()];
  const witnesses = placementWitnesses(catalog);
  for (const [sum, witness] of found) witnesses.set(`${id}\n${bagKey(bag)}\n${sum}`, witness);
  cache.set(key, sums);
  return sums;
}

function residualSums(
  catalog: Catalog,
  parentA: string,
  parentB: string,
  leftBag: readonly string[],
  rightBag: readonly string[],
): ResidualList {
  const leftKey = bagKey(leftBag);
  const rightKey = bagKey(rightBag);
  const key = `${parentA}\0${parentB}\0${leftKey}\0${rightKey}`;
  let cache = residualCache.get(catalog);
  if (!cache) {
    cache = new Map();
    residualCache.set(catalog, cache);
  }
  const saved = cache.get(key);
  if (saved) return saved;
  const lefts = leftBag.length ? placements(catalog, parentA, leftBag) : signatureList(catalog, parentA);
  const rights = rightBag.length ? placements(catalog, parentB, rightBag) : signatureList(catalog, parentB);
  const found = new Map<number, SplitWitness>();
  if (lefts.length > 0 && rights.length > 0) {
    for (const left of lefts) {
      for (const right of rights) {
        const sum = left + right;
        if (found.has(sum)) continue;
        found.set(sum, {
          parentA,
          parentB,
          left,
          right,
          leftBag: leftKey,
          rightBag: rightKey,
        });
      }
    }
  }
  const list = { sums: [...found.keys()], witnesses: [...found.values()] };
  cache.set(key, list);
  return list;
}

function materialize(catalog: Catalog, id: string, packed: number, bag: string): BuildStep {
  if (bag === id && !isStarter(id)) {
    return { creatureId: id, counts: emptyCounts(), left: null, right: null, owned: true };
  }
  if (isStarter(id)) {
    const counts = emptyCounts();
    counts[id] = 1;
    return { creatureId: id, counts, left: null, right: null };
  }
  const witness =
    bag === ""
      ? rawWitnessCache.get(catalog)?.get(`${id}|${packed}`)
      : placementWitnessCache.get(catalog)?.get(`${id}\n${bag}\n${packed}`);
  if (!witness) return { creatureId: id, counts: unpackCounts(packed), left: null, right: null };
  return {
    creatureId: id,
    counts: unpackCounts(packed),
    left: materialize(catalog, witness.parentA, witness.left, witness.leftBag),
    right: materialize(catalog, witness.parentB, witness.right, witness.rightBag),
  };
}

function rankFromSignatures(
  catalog: Catalog,
  creatureId: string,
  collapsed: StarterOption[],
  have: StarterCounts,
  usable: string[],
): StarterOption[] {
  const options = collapsed.map((source) => {
    const path = source.path;
    if (!path) return source;
    let bestCounts = source.counts;
    let bestUses: string[] = [];
    let bestWitness: SplitWitness | null = null;
    const masks = 1 << usable.length;
    for (let subset = 1; subset < masks; subset += 1) {
      const chosen: string[] = [];
      for (let index = 0; index < usable.length; index += 1) {
        if (subset & (1 << index)) chosen.push(usable[index]);
      }
      const splits = 1 << chosen.length;
      for (let split = 0; split < splits; split += 1) {
        const leftBag: string[] = [];
        const rightBag: string[] = [];
        for (let index = 0; index < chosen.length; index += 1) {
          if (split & (1 << index)) leftBag.push(chosen[index]);
          else rightBag.push(chosen[index]);
        }
        const residual = residualSums(catalog, path.parentA, path.parentB, leftBag, rightBag);
        for (let index = 0; index < residual.sums.length; index += 1) {
          const counts = unpackCounts(residual.sums[index]);
          if (!countsBeat(counts, bestCounts, have)) continue;
          bestCounts = counts;
          bestUses = chosen;
          bestWitness = residual.witnesses[index] ?? null;
        }
      }
    }
    const shortfall = starterShortfall(bestCounts, have);
    return {
      counts: bestCounts,
      shortfall,
      affordable: totalCount(shortfall) === 0,
      path,
      uses: [...bestUses],
      tree: bestWitness
        ? {
            creatureId,
            counts: bestCounts,
            left: materialize(catalog, bestWitness.parentA, bestWitness.left, bestWitness.leftBag),
            right: materialize(catalog, bestWitness.parentB, bestWitness.right, bestWitness.rightBag),
          }
        : null,
    };
  });
  return options.sort((a, b) => compareOptions(a, b, have));
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
  const collapsed = adviseStarters(paths, ownCounts, have);
  if (usable.length === 0) return collapsed;
  if (usable.length <= 4) return rankFromSignatures(catalog, creatureId, collapsed, have, usable);
  const prefer = new Set(usable);
  const cache = treeCacheFor(catalog, prefer);
  const pricedTrees = new Map<string, PricedTree>();
  const options = collapsed.map((source) => {
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

type CountPack =
  | { ok: true; counts: number[] }
  | { ok: false; error: "missing" | "cycle" | "not-starter"; creatureId: string };

function countKey(counts: StarterCounts): string {
  return `${counts.chick}:${counts.bunny}:${counts.cat}`;
}

const PACK = 1024;
const PACK2 = PACK * PACK;

function packCounts(counts: StarterCounts): number {
  return counts.chick + counts.bunny * PACK + counts.cat * PACK2;
}

function unpackCounts(packed: number): StarterCounts {
  return {
    chick: packed % PACK,
    bunny: Math.floor(packed / PACK) % PACK,
    cat: Math.floor(packed / PACK2),
  };
}

const breakdownCache = new WeakMap<Catalog, Map<string, Breakdown>>();

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
  let saved = breakdownCache.get(catalog);
  if (!saved) {
    saved = new Map();
    breakdownCache.set(catalog, saved);
  }
  const hit = saved.get(creatureId);
  if (hit) return hit;
  const result = collectBreakdown(creatureId, catalog);
  saved.set(creatureId, result);
  return result;
}

function collectBreakdown(creatureId: string, catalog: Catalog): Breakdown {
  const creatures = creatureMap(catalog.creatures);
  const creature = creatures.get(creatureId);
  if (!creature) return { status: "missing", creatureId };
  if (isStarter(creatureId)) {
    const counts = emptyCounts();
    counts[creatureId] = 1;
    return { status: "ok", total: 1, counts, paths: [] };
  }

  const recipesFor = recipesByResult(catalog.recipes);
  const cache = new Map<string, number[]>();
  const witnesses = new Map<string, SplitWitness>();
  const persist = () => rememberSignatures(catalog, cache, witnesses);

  function parentCounts(id: string, stack: string[]): CountPack {
    if (stack.includes(id)) return { ok: false, error: "cycle", creatureId: id };
    const cached = cache.get(id);
    if (cached) return { ok: true, counts: cached };
    const current = creatures.get(id);
    if (!current) return { ok: false, error: "missing", creatureId: id };
    if (current.tier === 1) {
      if (!isStarter(id)) return { ok: false, error: "not-starter", creatureId: id };
      const counts = emptyCounts();
      counts[id] = 1;
      const only = [packCounts(counts)];
      cache.set(id, only);
      return { ok: true, counts: only };
    }
    const recipes = recipesFor.get(id) ?? [];
    if (recipes.length === 0) return { ok: false, error: "missing", creatureId: id };
    const seen = new Set<number>();
    const counts: number[] = [];
    let failure: CountPack | null = null;
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
          const combined = parentLeft + parentRight;
          if (seen.has(combined)) continue;
          seen.add(combined);
          counts.push(combined);
          const witnessKey = `${id}|${combined}`;
          if (!witnesses.has(witnessKey)) {
            witnesses.set(witnessKey, {
              parentA: recipe.parentA,
              parentB: recipe.parentB,
              left: parentLeft,
              right: parentRight,
              leftBag: "",
              rightBag: "",
            });
          }
        }
      }
    }
    if (counts.length === 0) return failure ?? { ok: false, error: "missing", creatureId: id };
    cache.set(id, counts);
    return { ok: true, counts };
  }

  const recipes = recipesFor.get(creatureId) ?? [];
  if (recipes.length === 0) {
    persist();
    return { status: "missing", creatureId };
  }
  const paths: PathCounts[] = [];
  let failure: CountPack | null = null;
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
    const seen = new Set<number>();
    for (const parentLeft of left.counts) {
      for (const parentRight of right.counts) {
        const combined = parentLeft + parentRight;
        if (seen.has(combined)) continue;
        seen.add(combined);
        paths.push({
          recipeId: recipe.id,
          parentA: recipe.parentA,
          parentB: recipe.parentB,
          counts: unpackCounts(combined),
        });
      }
    }
  }
  if (paths.length === 0) {
    persist();
    if (!failure || failure.ok) return { status: "missing", creatureId };
    return { status: failure.error, creatureId: failure.creatureId };
  }
  persist();
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
