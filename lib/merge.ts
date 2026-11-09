import { ALL_STARTER_IDS, FARM_STARTERS, STARTER_NAMES } from "@/lib/farms";
import { starterTotal } from "@/lib/tiers";
import {
  type Catalog,
  type Creature,
  type Recipe,
  type StarterCounts,
} from "@/lib/types";

const LAND_STARTERS = FARM_STARTERS.land;

export function isStarter(id: string): boolean {
  return ALL_STARTER_IDS.has(id);
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
  return recipes.find(
    (recipe) => !recipe.parentC && pairKey(recipe.parentA, recipe.parentB) === key,
  );
}

export function trioKey(a: string, b: string, c: string): string {
  return [a, b, c].sort().join("|");
}

export function findTrio(
  recipes: Recipe[],
  a: string,
  b: string,
  c: string,
): Recipe | undefined {
  const key = trioKey(a, b, c);
  return recipes.find(
    (recipe) =>
      recipe.parentC !== undefined &&
      trioKey(recipe.parentA, recipe.parentB, recipe.parentC) === key,
  );
}

export function missingPartners(catalog: Catalog, creatureId: string): Creature[] {
  const creature = creatureMap(catalog.creatures).get(creatureId);
  if (!creature || creature.tier >= 7) return [];
  return catalog.creatures
    .filter(
      (other) =>
        other.tier === creature.tier && !findRecipe(catalog.recipes, creature.id, other.id),
    )
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function emptyCounts(starters: readonly string[] = LAND_STARTERS): StarterCounts {
  return Object.fromEntries(starters.map((id) => [id, 0]));
}

export function addCounts(a: StarterCounts, b: StarterCounts): StarterCounts {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const next: StarterCounts = {};
  for (const key of keys) next[key] = (a[key] ?? 0) + (b[key] ?? 0);
  return next;
}

export function totalCount(counts: StarterCounts): number {
  return Object.values(counts).reduce((sum, value) => sum + value, 0);
}

export function starterShortfall(need: StarterCounts, have: StarterCounts): StarterCounts {
  const next: StarterCounts = {};
  for (const key of Object.keys(need)) next[key] = Math.max(0, (need[key] ?? 0) - (have[key] ?? 0));
  return next;
}

export function canAfford(need: StarterCounts, have: StarterCounts): boolean {
  return totalCount(starterShortfall(need, have)) === 0;
}

function peakStrain(need: StarterCounts, have: StarterCounts): number {
  let peak = 0;
  for (const id of Object.keys(need)) {
    const needed = need[id] ?? 0;
    if (needed <= 0) continue;
    const owned = have[id] ?? 0;
    if (owned <= 0) return Number.POSITIVE_INFINITY;
    peak = Math.max(peak, needed / owned);
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
  third?: BuildStep | null;
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
  const cost = emptyCounts(Object.keys(node.counts));
  return {
    cost,
    uses: [node.creatureId],
    step: {
      creatureId: node.creatureId,
      counts: cost,
      left: null,
      right: null,
      owned: true,
    },
  };
}

function joined(
  node: BuildStep,
  left: PricedTree,
  right: PricedTree,
  third?: PricedTree,
): PricedTree {
  const pair = addCounts(left.cost, right.cost);
  const cost = third ? addCounts(pair, third.cost) : pair;
  return {
    cost,
    uses: third ? [...left.uses, ...right.uses, ...third.uses] : [...left.uses, ...right.uses],
    step: {
      creatureId: node.creatureId,
      counts: cost,
      left: left.step,
      right: right.step,
      ...(third ? { third: third.step } : {}),
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
    const third = node.third ? walk(node.third) : undefined;
    if (totalCount(node.left.counts) >= totalCount(node.right.counts)) {
      return joined(node, walk(node.left), walk(node.right), third);
    }
    const right = walk(node.right);
    return joined(node, walk(node.left), right, third);
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
    } else if (node.third && items.length > 0) {
      const ways = 3 ** items.length;
      for (let mask = 0; mask < ways; mask += 1) {
        const bags: string[][] = [[], [], []];
        let value = mask;
        for (const item of items) {
          bags[value % 3].push(item);
          value = Math.floor(value / 3);
        }
        consider(
          joined(
            node,
            solve(node.left, bags[0]),
            solve(node.right, bags[1]),
            solve(node.third, bags[2]),
          ),
        );
      }
    } else if (items.length === 0) {
      consider(
        joined(
          node,
          solve(node.left, []),
          solve(node.right, []),
          node.third ? solve(node.third, []) : undefined,
        ),
      );
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
    (step.right ? ownedOverlap(step.right, prefer, memo) : 0) +
    (step.third ? ownedOverlap(step.third, prefer, memo) : 0);
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
  const starters = catalog.starters;
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
      const counts = emptyCounts(starters);
      counts[id] = 1;
      found.set(countKey(counts, starters), { creatureId: id, counts, left: null, right: null });
      cache.set(id, found);
      return found;
    }
    const recipes = recipesFor.get(id) ?? [];
    for (const recipe of recipes) {
      if (recipe.parentC) continue;
      const left = options(recipe.parentA, [...stack, id]);
      const right = options(recipe.parentB, [...stack, id]);
      if (!left || !right) continue;
      for (const parentLeft of left.values()) {
        for (const parentRight of right.values()) {
          const counts = addCounts(parentLeft.counts, parentRight.counts);
          const key = countKey(counts, starters);
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
    const complementCounts = emptyCounts(starters);
    for (const starter of starters) {
      complementCounts[starter] = (path.counts[starter] ?? 0) - (parentLeft.counts[starter] ?? 0);
    }
    const complement = countKey(complementCounts, starters);
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
    const counts = emptyCounts(catalog.starters);
    counts[id] = 1;
    const only = [packCounts(counts, catalog.starters)];
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
    if (recipe.parentC) found.add(recipe.parentC);
    for (const child of descendantsOf(catalog, recipe.parentA)) found.add(child);
    for (const child of descendantsOf(catalog, recipe.parentB)) found.add(child);
    if (recipe.parentC) {
      for (const child of descendantsOf(catalog, recipe.parentC)) found.add(child);
    }
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
    return { creatureId: id, counts: emptyCounts(catalog.starters), left: null, right: null, owned: true };
  }
  if (isStarter(id)) {
    const counts = emptyCounts(catalog.starters);
    counts[id] = 1;
    return { creatureId: id, counts, left: null, right: null };
  }
  const witness =
    bag === ""
      ? rawWitnessCache.get(catalog)?.get(`${id}|${packed}`)
      : placementWitnessCache.get(catalog)?.get(`${id}\n${bag}\n${packed}`);
  if (!witness) return { creatureId: id, counts: unpackCounts(packed, catalog.starters), left: null, right: null };
  return {
    creatureId: id,
    counts: unpackCounts(packed, catalog.starters),
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
          const counts = unpackCounts(residual.sums[index], catalog.starters);
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

type TriplePick = { id: string; packed: number; bag: string };
type TripleMix = { sum: number; counts: StarterCounts; uses: string[]; picks: TriplePick[] };

const tripleMixCache = new WeakMap<Catalog, Map<string, TripleMix | null>>();
const pairSumCache = new WeakMap<number[], Map<number[], { sums: number[]; left: number[]; right: number[] }>>();

function shortfallPacked(packed: number, have: StarterCounts, starters: readonly string[]): number {
  const counts = unpackCounts(packed, starters);
  let total = 0;
  for (const id of starters) total += Math.max(0, (counts[id] ?? 0) - (have[id] ?? 0));
  return total;
}

function keepPacked(sum: number, best: number, have: StarterCounts, starters: readonly string[]): boolean {
  const nextShort = shortfallPacked(sum, have, starters);
  const currentShort = shortfallPacked(best, have, starters);
  if (nextShort !== currentShort) return nextShort < currentShort;
  return countsBeat(unpackCounts(sum, starters), unpackCounts(best, starters), have);
}

function uniquePair(left: number[], right: number[]) {
  let byRight = pairSumCache.get(left);
  if (!byRight) {
    byRight = new Map();
    pairSumCache.set(left, byRight);
  }
  const saved = byRight.get(right);
  if (saved) return saved;
  const found = new Map<number, { left: number; right: number }>();
  for (const a of left) {
    for (const b of right) {
      const sum = a + b;
      if (!found.has(sum)) found.set(sum, { left: a, right: b });
    }
  }
  const record = { sums: [] as number[], left: [] as number[], right: [] as number[] };
  for (const [sum, part] of found) {
    record.sums.push(sum);
    record.left.push(part.left);
    record.right.push(part.right);
  }
  byRight.set(right, record);
  return record;
}

function bestPacked(list: number[], have: StarterCounts, starters: readonly string[]): number {
  let best = list[0] ?? 0;
  for (const packed of list) if (keepPacked(packed, best, have, starters)) best = packed;
  return best;
}

function scanTwo(
  left: number[],
  right: number[],
  have: StarterCounts,
  starters: readonly string[],
): { sum: number; left: number; right: number } {
  let best = (left[0] ?? 0) + (right[0] ?? 0);
  let bestLeft = left[0] ?? 0;
  let bestRight = right[0] ?? 0;
  for (const a of left) {
    for (const b of right) {
      const sum = a + b;
      if (!keepPacked(sum, best, have, starters)) continue;
      best = sum;
      bestLeft = a;
      bestRight = b;
    }
  }
  return { sum: best, left: bestLeft, right: bestRight };
}

function bestSum(
  lists: number[][],
  have: StarterCounts,
  starters: readonly string[],
): { sum: number; picks: number[] } | null {
  if (lists.length === 0 || lists.some((list) => list.length === 0)) return null;
  if (lists.length === 1) return { sum: bestPacked(lists[0], have, starters), picks: [bestPacked(lists[0], have, starters)] };
  const product = lists.reduce((total, list) => total * list.length, 1);
  if (lists.length === 2 && product <= 8_000_000) {
    const scanned = scanTwo(lists[0], lists[1], have, starters);
    return { sum: scanned.sum, picks: [scanned.left, scanned.right] };
  }
  if (lists.length >= 3) {
    const order = [0, 1, 2].sort((a, b) => lists[b].length - lists[a].length);
    const bigA = lists[order[0]];
    const bigB = lists[order[1]];
    const small = lists[order[2]];
    if (bigA.length * bigB.length <= 8_000_000) {
      const pair = uniquePair(bigA, bigB);
      const scanned = scanTwo(pair.sums, small, have, starters);
      const pairIndex = pair.sums.indexOf(scanned.left);
      const picks = [0, 0, 0];
      picks[order[0]] = pair.left[pairIndex] ?? bigA[0];
      picks[order[1]] = pair.right[pairIndex] ?? bigB[0];
      picks[order[2]] = scanned.right;
      return { sum: scanned.sum, picks };
    }
  }
  const picks = lists.map((list) => bestPacked(list, have, starters));
  return { sum: picks.reduce((total, packed) => total + packed, 0), picks };
}

function vectorsFor(
  catalog: Catalog,
  id: string,
  have: StarterCounts,
  bag: readonly string[],
  stack: string[],
): number[] {
  if (stack.includes(id)) return [];
  if (bag.length === 1 && bag[0] === id && !isStarter(id)) return [0];
  if (bag.includes(id) || (bag.length > 0 && isStarter(id))) return [];
  const recipes = recipeIndex(catalog).get(id) ?? [];
  const triples = recipes.filter((recipe) => recipe.parentC);
  const pairs = recipes.filter((recipe) => !recipe.parentC);
  const found = new Set<number>();
  if (pairs.length > 0) {
    const list = bag.length === 0 ? signatureList(catalog, id) : placements(catalog, id, [...bag]);
    for (const packed of list) found.add(packed);
  } else if (bag.length === 0 && (isStarter(id) || recipes.length === 0)) {
    for (const packed of signatureList(catalog, id)) found.add(packed);
  }
  for (const recipe of triples) {
    if (!recipe.parentC) continue;
    const mix = bestOwnedTriple(
      catalog,
      [recipe.parentA, recipe.parentB, recipe.parentC],
      have,
      bag,
      [...stack, id],
    );
    if (mix) found.add(mix.sum);
  }
  return [...found];
}

function bestOwnedTriple(
  catalog: Catalog,
  parents: [string, string, string],
  have: StarterCounts,
  owned: readonly string[],
  stack: string[] = [],
): TripleMix | null {
  const starters = catalog.starters;
  const usable = owned.length <= 2 ? owned : owned.filter((id) => parents.includes(id));
  const haveKey = starters.map((id) => have[id] ?? 0).join(":");
  const key = `${parents.join("|")}|${haveKey}|${bagKey(usable)}|${stack.join(".")}`;
  let saved = tripleMixCache.get(catalog);
  if (!saved) {
    saved = new Map();
    tripleMixCache.set(catalog, saved);
  }
  if (saved.has(key)) return saved.get(key) ?? null;
  let best: TripleMix | null = null;
  const ways = 4 ** usable.length;
  for (let mask = 0; mask < Math.max(ways, 1); mask += 1) {
    const bags: string[][] = [[], [], []];
    let value = mask;
    const uses: string[] = [];
    for (const item of usable) {
      const slot = usable.length === 0 ? 3 : value % 4;
      value = Math.floor(value / 4);
      if (slot < 3) {
        bags[slot].push(item);
        uses.push(item);
      }
    }
    const lists = parents.map((id, index) => vectorsFor(catalog, id, have, bags[index], stack));
    const picked = bestSum(lists, have, starters);
    if (!picked) continue;
    const counts = unpackCounts(picked.sum, starters);
    if (best && !countsBeat(counts, best.counts, have)) continue;
    best = {
      sum: picked.sum,
      counts,
      uses,
      picks: parents.map((id, index) => ({ id, packed: picked.picks[index] ?? 0, bag: bagKey(bags[index]) })),
    };
  }
  saved.set(key, best);
  return best;
}

function tripleOption(
  catalog: Catalog,
  creatureId: string,
  path: PathCounts,
  have: StarterCounts,
  owned: readonly string[],
): StarterOption {
  const parents: [string, string, string] = [path.parentA, path.parentB, path.parentC ?? path.parentB];
  const mix = path.parentC ? bestOwnedTriple(catalog, parents, have, owned) : null;
  const counts = mix?.counts ?? path.counts;
  const shortfall = starterShortfall(counts, have);
  const tree = mix
    ? {
        creatureId,
        counts,
        left: materialize(catalog, mix.picks[0].id, mix.picks[0].packed, mix.picks[0].bag),
        right: materialize(catalog, mix.picks[1].id, mix.picks[1].packed, mix.picks[1].bag),
        third: materialize(catalog, mix.picks[2].id, mix.picks[2].packed, mix.picks[2].bag),
      }
    : null;
  return {
    counts,
    shortfall,
    affordable: totalCount(shortfall) === 0,
    path,
    uses: mix?.uses ?? [],
    tree,
  };
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
  const pairPaths = paths.filter((path) => !path.parentC);
  const tripleOptions = paths
    .filter((path) => path.parentC)
    .map((path) => tripleOption(catalog, creatureId, path, have, usable));
  if (pairPaths.length === 0) return tripleOptions.sort((a, b) => compareOptions(a, b, have));
  const collapsed = adviseStarters(pairPaths, ownCounts, have);
  const pairOptions =
    usable.length === 0
      ? collapsed
      : usable.length <= 4
        ? rankFromSignatures(catalog, creatureId, collapsed, have, usable)
        : null;
  if (pairOptions) return [...pairOptions, ...tripleOptions].sort((a, b) => compareOptions(a, b, have));
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
  return [...options, ...tripleOptions].sort((a, b) => compareOptions(a, b, have));
}

export type MergeAttempt =
  | { ok: true; resultId: string }
  | { ok: false; reason: "same-tier" | "max-tier" | "needs-third" | "unknown" };

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
  if (a.tier >= 7) return { ok: false, reason: "needs-third" };
  const recipe = findRecipe(catalog.recipes, aId, bId);
  if (!recipe) return { ok: false, reason: "unknown" };
  return { ok: true, resultId: recipe.resultId };
}

export function attemptTriple(
  catalog: Catalog,
  aId: string,
  bId: string,
  cId: string,
): MergeAttempt {
  const map = creatureMap(catalog.creatures);
  const a = map.get(aId);
  const b = map.get(bId);
  const c = map.get(cId);
  if (!a || !b || !c || a.tier !== b.tier || a.tier !== c.tier) {
    return { ok: false, reason: "same-tier" };
  }
  if (a.tier >= 10) return { ok: false, reason: "max-tier" };
  if (a.tier < 7) return { ok: false, reason: "unknown" };
  const recipe = findTrio(catalog.recipes, aId, bId, cId);
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
      dependsOn(catalog, recipe.parentB, target, ignoreRecipeId, seen) ||
      (recipe.parentC ? dependsOn(catalog, recipe.parentC, target, ignoreRecipeId, seen) : false),
  );
}

export function validateRecipe(
  catalog: Catalog,
  parentA: string,
  parentB: string,
  resultId: string,
  ignoreRecipeId?: string,
  parentC?: string,
): string | null {
  const map = creatureMap(catalog.creatures);
  const a = map.get(parentA);
  const b = map.get(parentB);
  const c = parentC ? map.get(parentC) : undefined;
  const result = map.get(resultId);
  if (!a || !b || !result || (parentC && !c)) return "Pick creatures that are in the list.";
  if (a.tier !== b.tier || (c && c.tier !== a.tier)) {
    return "Those creatures are different tiers. A merge needs the same tier.";
  }
  if (a.tier >= 10) {
    return "Tier 10 creatures have no higher tier to merge into.";
  }
  if (a.tier >= 7 && !parentC) {
    return "Tier 7, 8, and 9 merges need a third creature.";
  }
  if (a.tier < 7 && parentC) {
    return "Tiers 1 through 6 merge two creatures.";
  }
  if (result.tier !== a.tier + 1) {
    return `The result has to be tier ${a.tier + 1}.`;
  }
  const existing = parentC
    ? catalog.recipes.find(
        (recipe) =>
          recipe.id !== ignoreRecipeId &&
          recipe.parentC !== undefined &&
          trioKey(recipe.parentA, recipe.parentB, recipe.parentC) === trioKey(parentA, parentB, parentC),
      )
    : catalog.recipes.find(
        (recipe) =>
          recipe.id !== ignoreRecipeId &&
          !recipe.parentC &&
          pairKey(recipe.parentA, recipe.parentB) === pairKey(parentA, parentB),
      );
  if (existing) {
    return `That combo already makes ${creatureName(catalog, existing.resultId)}.`;
  }
  if (
    dependsOn(catalog, parentA, resultId, ignoreRecipeId, new Set()) ||
    dependsOn(catalog, parentB, resultId, ignoreRecipeId, new Set()) ||
    (parentC ? dependsOn(catalog, parentC, resultId, ignoreRecipeId, new Set()) : false)
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
  if (tier === 1) {
    const names = creatures
      .filter((creature) => creature.locked && creature.tier === 1)
      .map((creature) => creature.name);
    return `Only ${names.length > 0 ? names.join(", ") : "the tier 1 starters"} can be tier 1.`;
  }
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
      recipe.parentA === id ||
      recipe.parentB === id ||
      recipe.parentC === id ||
      recipe.resultId === id;
    if (!involved) continue;
    const parentA = map.get(recipe.parentA);
    const parentB = map.get(recipe.parentB);
    const parentC = recipe.parentC ? map.get(recipe.parentC) : undefined;
    const result = map.get(recipe.resultId);
    if (!parentA || !parentB || !result || (recipe.parentC && !parentC)) continue;
    const tierA = recipe.parentA === id ? nextTier : parentA.tier;
    const tierB = recipe.parentB === id ? nextTier : parentB.tier;
    const tierC = recipe.parentC ? (recipe.parentC === id ? nextTier : parentC?.tier) : tierA;
    const tierResult = recipe.resultId === id ? nextTier : result.tier;
    if (tierA !== tierB || tierC !== tierA) {
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
  parentC?: string;
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

function countKey(counts: StarterCounts, starters: readonly string[] = Object.keys(counts)): string {
  return starters.map((id) => counts[id] ?? 0).join(":");
}

const PACK = 4096;
const PACK2 = PACK * PACK;

function packCounts(counts: StarterCounts, starters: readonly string[]): number {
  return (counts[starters[0]] ?? 0) + (counts[starters[1]] ?? 0) * PACK + (counts[starters[2]] ?? 0) * PACK2;
}

function unpackCounts(packed: number, starters: readonly string[]): StarterCounts {
  return {
    [starters[0]]: packed % PACK,
    [starters[1]]: Math.floor(packed / PACK) % PACK,
    [starters[2]]: Math.floor(packed / PACK2),
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
    const counts = emptyCounts(catalog.starters);
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
      const counts = emptyCounts(catalog.starters);
      counts[id] = 1;
      const only = [packCounts(counts, catalog.starters)];
      cache.set(id, only);
      return { ok: true, counts: only };
    }
    const recipes = recipesFor.get(id) ?? [];
    if (recipes.length === 0) return { ok: false, error: "missing", creatureId: id };
    const seen = new Set<number>();
    const counts: number[] = [];
    let failure: CountPack | null = null;
    for (const recipe of recipes) {
      const slots = [recipe.parentA, recipe.parentB, ...(recipe.parentC ? [recipe.parentC] : [])];
      const parts: number[][] = [];
      let failed = false;
      for (const slot of slots) {
        const part = parentCounts(slot, [...stack, id]);
        if (!part.ok) {
          failure ??= part;
          failed = true;
          break;
        }
        parts.push(part.counts);
      }
      if (failed || parts.some((part) => part.length === 0)) continue;
      if (parts.length === 3) {
        const combined = parts[0][0] + parts[1][0] + parts[2][0];
        if (seen.has(combined)) continue;
        seen.add(combined);
        counts.push(combined);
        continue;
      }
      for (const parentLeft of parts[0]) {
        for (const parentRight of parts[1]) {
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
    if (recipe.parentC) {
      const third = parentCounts(recipe.parentC, [creatureId]);
      if (!third.ok) {
        failure ??= third;
        continue;
      }
      if (left.counts[0] === undefined || right.counts[0] === undefined || third.counts[0] === undefined) {
        continue;
      }
      paths.push({
        recipeId: recipe.id,
        parentA: recipe.parentA,
        parentB: recipe.parentB,
        parentC: recipe.parentC,
        counts: unpackCounts(left.counts[0] + right.counts[0] + third.counts[0], catalog.starters),
      });
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
          counts: unpackCounts(combined, catalog.starters),
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
  const counts = paths[0]?.counts ?? emptyCounts(catalog.starters);
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

export function starterLabel(id: string): string {
  return STARTER_NAMES[id] ?? id;
}
