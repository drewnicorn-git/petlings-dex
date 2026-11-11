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

export function autoGenerateThirds(
  catalog: Catalog,
  parentA: string,
  parentB: string,
  thirdId: string,
): Creature[] {
  const map = creatureMap(catalog.creatures);
  const first = map.get(parentA);
  const third = map.get(thirdId);
  if (!first || !third || first.tier !== third.tier || third.tier < 7 || third.tier >= 10) return [];
  const start = third.name.toLocaleLowerCase();
  return catalog.creatures
    .filter((creature) => creature.tier === third.tier)
    .filter((creature) => creature.name.toLocaleLowerCase().localeCompare(start) >= 0)
    .filter((creature) => !findTrio(catalog.recipes, parentA, parentB, creature.id))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function missingThirds(catalog: Catalog, parentA: string, parentB: string): Creature[] {
  const map = creatureMap(catalog.creatures);
  const first = map.get(parentA);
  const second = map.get(parentB);
  if (!first || !second || first.tier !== second.tier || first.tier < 7 || first.tier >= 10) return [];
  return catalog.creatures
    .filter(
      (other) =>
        other.tier === first.tier && !findTrio(catalog.recipes, first.id, second.id, other.id),
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

function highestTier(uses: readonly string[], tiers: ReadonlyMap<string, number>): number {
  return uses.reduce((max, id) => Math.max(max, tiers.get(id) ?? 0), 0);
}

function quoteRank(
  a: PricedTree,
  b: PricedTree,
  have: StarterCounts,
  tiers: ReadonlyMap<string, number>,
): number {
  const aShort = totalCount(starterShortfall(a.cost, have));
  const bShort = totalCount(starterShortfall(b.cost, have));
  const aDone = aShort === 0;
  const bDone = bShort === 0;
  if (aDone !== bDone) return aDone ? -1 : 1;
  const aTier = highestTier(a.uses, tiers);
  const bTier = highestTier(b.uses, tiers);
  if (aTier !== bTier) return bTier - aTier;
  if (!aDone && aShort !== bShort) return aShort - bShort;
  return cheaperCost(a.cost, b.cost, have);
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

function priceGreedy(step: BuildStep, owned: string[], tiers: ReadonlyMap<string, number>): PricedTree {
  const counts = new Map<string, number>();
  for (const id of owned) counts.set(id, (counts.get(id) ?? 0) + 1);
  const nodes: BuildStep[] = [];
  const walkNodes = (node: BuildStep) => {
    nodes.push(node);
    if (node.left) walkNodes(node.left);
    if (node.right) walkNodes(node.right);
    if (node.third) walkNodes(node.third);
  };
  walkNodes(step);
  nodes.sort((a, b) => (tiers.get(b.creatureId) ?? 0) - (tiers.get(a.creatureId) ?? 0));
  const skip = new Set<BuildStep>();
  const spent = new Set<BuildStep>();
  const block = (node: BuildStep) => {
    skip.add(node);
    if (node.left) block(node.left);
    if (node.right) block(node.right);
    if (node.third) block(node.third);
  };
  for (const node of nodes) {
    if (skip.has(node) || isStarter(node.creatureId)) continue;
    const available = counts.get(node.creatureId) ?? 0;
    if (available <= 0) continue;
    counts.set(node.creatureId, available - 1);
    spent.add(node);
    block(node);
  }

  function walk(node: BuildStep): PricedTree {
    if (spent.has(node)) return covered(node);
    if (!node.left || !node.right) return { cost: node.counts, uses: [], step: node };
    const third = node.third ? walk(node.third) : undefined;
    return joined(node, walk(node.left), walk(node.right), third);
  }

  return walk(step);
}

export function priceTree(
  step: BuildStep,
  owned: string[],
  have: StarterCounts,
  memo: Map<string, PricedTree> = new Map(),
  tiers: ReadonlyMap<string, number> = new Map(),
): PricedTree {
  if (owned.length > 8) return priceGreedy(step, owned, tiers);

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
      if (!best || quoteRank(quote, best, have, tiers) < 0) best = quote;
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
  tierOf: (id: string) => number,
): number {
  const cached = memo.get(step);
  if (cached !== undefined) return cached;
  const here = prefer.has(step.creatureId) ? tierOf(step.creatureId) * 10000 + totalCount(step.counts) : 0;
  const score =
    here +
    (step.left ? ownedOverlap(step.left, prefer, memo, tierOf) : 0) +
    (step.right ? ownedOverlap(step.right, prefer, memo, tierOf) : 0) +
    (step.third ? ownedOverlap(step.third, prefer, memo, tierOf) : 0);
  memo.set(step, score);
  return score;
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
  const tierOf = (id: string) => creatures.get(id)?.tier ?? 0;

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
              ownedOverlap(previous, prefer, overlapMemo, tierOf) >=
                ownedOverlap(candidate, prefer, overlapMemo, tierOf))
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
const signatureFrontCache = new WeakMap<Catalog, Map<string, number[]>>();
const rawWitnessCache = new WeakMap<Catalog, Map<string, SplitWitness>>();
const placementCache = new WeakMap<Catalog, Map<string, number[]>>();
const placementWitnessCache = new WeakMap<Catalog, Map<string, SplitWitness>>();
const placeableCache = new WeakMap<Catalog, Map<string, boolean>>();
const tierCache = new WeakMap<Catalog, Map<string, number>>();
const descendantCache = new WeakMap<Catalog, Map<string, Set<string>>>();
const recipeIndexCache = new WeakMap<Catalog, Map<string, Recipe[]>>();

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

function packedDominates(better: number, worse: number): boolean {
  const betterFirst = better % PACK;
  const betterSecond = Math.floor(better / PACK) % PACK;
  const betterThird = Math.floor(better / PACK2);
  const worseFirst = worse % PACK;
  const worseSecond = Math.floor(worse / PACK) % PACK;
  const worseThird = Math.floor(worse / PACK2);
  return (
    betterFirst <= worseFirst &&
    betterSecond <= worseSecond &&
    betterThird <= worseThird &&
    (betterFirst < worseFirst || betterSecond < worseSecond || betterThird < worseThird)
  );
}

function paretoPacked(list: readonly number[]): number[] {
  if (list.length <= 1) return [...list];
  const front: number[] = [];
  for (const candidate of list) {
    let dominated = false;
    for (let index = 0; index < front.length; index += 1) {
      const current = front[index];
      if (current === candidate || packedDominates(current, candidate)) {
        dominated = true;
        break;
      }
      if (packedDominates(candidate, current)) {
        front.splice(index, 1);
        index -= 1;
      }
    }
    if (!dominated) front.push(candidate);
  }
  return front;
}

function fullSignatureList(catalog: Catalog, id: string): number[] {
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

function signatureList(catalog: Catalog, id: string): number[] {
  let fronts = signatureFrontCache.get(catalog);
  if (!fronts) {
    fronts = new Map();
    signatureFrontCache.set(catalog, fronts);
  }
  const saved = fronts.get(id);
  if (saved) return saved;
  const front = paretoPacked(fullSignatureList(catalog, id));
  fronts.set(id, front);
  return front;
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

function rememberSum(found: Map<number, SplitWitness>, sum: number, witness: SplitWitness) {
  for (const current of [...found.keys()]) {
    if (current === sum || packedDominates(current, sum)) return;
    if (packedDominates(sum, current)) found.delete(current);
  }
  found.set(sum, witness);
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
  for (const recipe of recipeIndex(catalog).get(id) ?? []) {
    if (recipe.parentC) continue;
    const pinnedLeft: string[] = [];
    const pinnedRight: string[] = [];
    const shared: string[] = [];
    let hosted = true;
    for (const item of bag) {
      const inLeft = item === recipe.parentA || descendantsOf(catalog, recipe.parentA).has(item);
      const inRight = item === recipe.parentB || descendantsOf(catalog, recipe.parentB).has(item);
      if (inLeft && inRight) shared.push(item);
      else if (inLeft) pinnedLeft.push(item);
      else if (inRight) pinnedRight.push(item);
      else {
        hosted = false;
        break;
      }
    }
    if (!hosted) continue;
    const masks = 1 << shared.length;
    for (let mask = 0; mask < masks; mask += 1) {
      const leftBag = pinnedLeft.slice();
      const rightBag = pinnedRight.slice();
      for (let index = 0; index < shared.length; index += 1) {
        if (mask & (1 << index)) leftBag.push(shared[index]);
        else rightBag.push(shared[index]);
      }
      const lefts = leftBag.length
        ? placements(catalog, recipe.parentA, leftBag)
        : signatureList(catalog, recipe.parentA);
      const rights = rightBag.length
        ? placements(catalog, recipe.parentB, rightBag)
        : signatureList(catalog, recipe.parentB);
      if (lefts.length === 0 || rights.length === 0) continue;
      const leftKey = bagKey(leftBag);
      const rightKey = bagKey(rightBag);
      for (const left of lefts) {
        for (const right of rights) {
          rememberSum(found, left + right, {
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
  for (const [sum, witness] of found) witnesses.set(`${key}\n${sum}`, witness);
  cache.set(key, sums);
  return sums;
}

function canPlace(catalog: Catalog, id: string, bag: readonly string[]): boolean {
  const key = `${id}\n${bagKey(bag)}`;
  let cache = placeableCache.get(catalog);
  if (!cache) {
    cache = new Map();
    placeableCache.set(catalog, cache);
  }
  const saved = cache.get(key);
  if (saved !== undefined) return saved;
  const answer = bag.length === 0 ? signatureList(catalog, id).length > 0 : placeable(catalog, id, bag);
  cache.set(key, answer);
  return answer;
}

function catalogTiers(catalog: Catalog): Map<string, number> {
  let tiers = tierCache.get(catalog);
  if (!tiers) {
    tiers = new Map(catalog.creatures.map((creature) => [creature.id, creature.tier]));
    tierCache.set(catalog, tiers);
  }
  return tiers;
}

function fitsCapacity(catalog: Catalog, id: string, bag: readonly string[]): boolean {
  const tiers = catalogTiers(catalog);
  const tier = tiers.get(id) ?? 0;
  const branch = (recipeIndex(catalog).get(id) ?? []).some((recipe) => recipe.parentC) ? 3 : 2;
  const counts = new Map<number, number>();
  for (const item of bag) {
    const itemTier = tiers.get(item) ?? 0;
    if (itemTier > tier) return false;
    counts.set(itemTier, (counts.get(itemTier) ?? 0) + 1);
  }
  for (const [itemTier, count] of counts) {
    let room = 1;
    for (let step = itemTier; step < tier; step += 1) room *= branch;
    if (count > room) return false;
  }
  return true;
}

function placeable(catalog: Catalog, id: string, bag: readonly string[]): boolean {
  if (bag.length === 1 && bag[0] === id && !isStarter(id)) return true;
  if (isStarter(id) || bag.includes(id)) return false;
  if (!fitsCapacity(catalog, id, bag)) return false;
  if (!bag.every((item) => descendantsOf(catalog, id).has(item))) return false;
  if (bag.length === 1) return true;
  const recipes = recipeIndex(catalog).get(id) ?? [];
  if (recipes.some((recipe) => recipe.parentC)) {
    return parentVectors(catalog, id, bag, emptyCounts(catalog.starters)).length > 0;
  }
  const hostedRecipes: { parentA: string; parentB: string; pinnedLeft: string[]; pinnedRight: string[]; shared: string[] }[] = [];
  for (const recipe of recipes) {
    if (recipe.parentC) continue;
    const pinnedLeft: string[] = [];
    const pinnedRight: string[] = [];
    const shared: string[] = [];
    let hosted = true;
    for (const item of bag) {
      const inLeft = item === recipe.parentA || descendantsOf(catalog, recipe.parentA).has(item);
      const inRight = item === recipe.parentB || descendantsOf(catalog, recipe.parentB).has(item);
      if (inLeft && inRight) shared.push(item);
      else if (inLeft) pinnedLeft.push(item);
      else if (inRight) pinnedRight.push(item);
      else {
        hosted = false;
        break;
      }
    }
    if (hosted) hostedRecipes.push({ parentA: recipe.parentA, parentB: recipe.parentB, pinnedLeft, pinnedRight, shared });
  }
  hostedRecipes.sort((a, b) => a.shared.length - b.shared.length);
  for (const recipe of hostedRecipes) {
    const masks = 1 << recipe.shared.length;
    for (let mask = 0; mask < masks; mask += 1) {
      const leftBag = recipe.pinnedLeft.slice();
      const rightBag = recipe.pinnedRight.slice();
      for (let index = 0; index < recipe.shared.length; index += 1) {
        if (mask & (1 << index)) leftBag.push(recipe.shared[index]);
        else rightBag.push(recipe.shared[index]);
      }
      const leftOk = leftBag.length === 0 || canPlace(catalog, recipe.parentA, leftBag);
      const rightOk = rightBag.length === 0 || canPlace(catalog, recipe.parentB, rightBag);
      if (leftOk && rightOk) return true;
    }
  }
  return false;
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

function tierMap(catalog: Catalog): Map<string, number> {
  return catalogTiers(catalog);
}

function compareUsage(
  a: readonly string[],
  b: readonly string[],
  tiers: ReadonlyMap<string, number>,
): number {
  for (let tier = 10; tier >= 2; tier -= 1) {
    let aCount = 0;
    let bCount = 0;
    for (const id of a) if ((tiers.get(id) ?? 0) === tier) aCount += 1;
    for (const id of b) if ((tiers.get(id) ?? 0) === tier) bCount += 1;
    if (aCount !== bCount) return bCount - aCount;
  }
  return 0;
}

function holdsOwned(node: BuildStep): boolean {
  return (
    node.owned === true ||
    (node.left ? holdsOwned(node.left) : false) ||
    (node.right ? holdsOwned(node.right) : false) ||
    (node.third ? holdsOwned(node.third) : false)
  );
}

export function materialFrontier(step: BuildStep): { creatureId: string; owned: boolean }[] {
  const found: { creatureId: string; owned: boolean }[] = [];
  const walk = (node: BuildStep) => {
    if (node.owned || !node.left || !node.right || !holdsOwned(node)) {
      found.push({ creatureId: node.creatureId, owned: node.owned === true });
      return;
    }
    walk(node.left);
    walk(node.right);
    if (node.third) walk(node.third);
  };
  if (!step.left || !step.right) {
    return [{ creatureId: step.creatureId, owned: step.owned === true }];
  }
  walk(step.left);
  walk(step.right);
  if (step.third) walk(step.third);
  return found;
}

function canLive(catalog: Catalog, item: string, parent: string): boolean {
  return item === parent || descendantsOf(catalog, parent).has(item);
}

function parentVectors(
  catalog: Catalog,
  id: string,
  bag: readonly string[],
  have: StarterCounts,
): number[] {
  if (bag.length === 1 && bag[0] === id && !isStarter(id)) return [0];
  const recipes = recipeIndex(catalog).get(id) ?? [];
  if (recipes.some((recipe) => recipe.parentC)) return vectorsFor(catalog, id, have, bag, []);
  if (bag.length === 0) return signatureList(catalog, id);
  return placements(catalog, id, bag);
}

type TriplePick = { id: string; packed: number; bag: string };

function coverSource(
  catalog: Catalog,
  creatureId: string,
  source: StarterOption,
  have: StarterCounts,
  owned: readonly string[],
  tiers: ReadonlyMap<string, number>,
): StarterOption {
  const path = source.path;
  if (!path || owned.length === 0) return source;
  const parents = [path.parentA, path.parentB, ...(path.parentC ? [path.parentC] : [])];
  const items = owned
    .filter((id) => parents.some((parent) => canLive(catalog, id, parent)))
    .sort((a, b) => (tiers.get(b) ?? 0) - (tiers.get(a) ?? 0) || a.localeCompare(b));
  if (items.length === 0) return source;
  const best: {
    uses: string[];
    counts: StarterCounts;
    picks: TriplePick[] | null;
    bags: string[][] | null;
  } = { uses: [], counts: source.counts, picks: null, bags: null };

  function consider(bags: string[][]) {
    const uses = bags.flat();
    if (uses.length === 0) return;
    const lists = parents.map((id, index) => parentVectors(catalog, id, bags[index], have));
    const picked = bestSum(lists, have, catalog.starters);
    if (!picked) return;
    const counts = unpackCounts(picked.sum, catalog.starters);
    const usage = compareUsage(uses, best.uses, tiers);
    if (usage > 0) return;
    if (usage === 0 && !countsBeat(counts, best.counts, have)) return;
    best.uses = [...uses];
    best.counts = counts;
    best.bags = bags.map((bag) => [...bag]);
    best.picks = parents.map((id, index) => ({
      id,
      packed: picked.picks[index] ?? 0,
      bag: bagKey(bags[index]),
    }));
  }

  const bags = parents.map(() => [] as string[]);
  function roomFor(parent: string, itemTier: number): number {
    const parentTier = tiers.get(parent) ?? 0;
    if (itemTier > parentTier) return 0;
    const branch = (recipeIndex(catalog).get(parent) ?? []).some((recipe) => recipe.parentC) ? 3 : 2;
    let room = 1;
    for (let step = itemTier; step < parentTier; step += 1) room *= branch;
    return room;
  }
  function absorb(item: string): boolean {
    const itemTier = tiers.get(item) ?? 0;
    for (let slot = 0; slot < parents.length; slot += 1) {
      if (!canLive(catalog, item, parents[slot])) continue;
      const sameTier = bags[slot].reduce(
        (count, id) => count + ((tiers.get(id) ?? 0) === itemTier ? 1 : 0),
        0,
      );
      if (sameTier >= roomFor(parents[slot], itemTier)) continue;
      bags[slot].push(item);
      if (canPlace(catalog, parents[slot], bags[slot])) return true;
      bags[slot].pop();
    }
    for (let slot = 0; slot < parents.length; slot += 1) {
      if (!canLive(catalog, item, parents[slot])) continue;
      for (let index = 0; index < bags[slot].length; index += 1) {
        const moved = bags[slot][index];
        if ((tiers.get(moved) ?? 0) > itemTier) continue;
        bags[slot].splice(index, 1);
        bags[slot].push(item);
        if (!canPlace(catalog, parents[slot], bags[slot])) {
          bags[slot].pop();
          bags[slot].splice(index, 0, moved);
          continue;
        }
        let parked = false;
        for (let dest = 0; dest < parents.length; dest += 1) {
          if (dest === slot || !canLive(catalog, moved, parents[dest])) continue;
          bags[dest].push(moved);
          if (canPlace(catalog, parents[dest], bags[dest])) {
            parked = true;
            break;
          }
          bags[dest].pop();
        }
        if (parked) return true;
        bags[slot].pop();
        bags[slot].splice(index, 0, moved);
      }
    }
    return false;
  }
  const skipped: string[] = [];
  for (const item of items) if (!absorb(item)) skipped.push(item);
  for (const item of skipped) absorb(item);
  consider(bags);
  const picks = best.picks;
  if (!picks) return source;
  const shortfall = starterShortfall(best.counts, have);
  return {
    counts: best.counts,
    shortfall,
    affordable: totalCount(shortfall) === 0,
    path,
    uses: best.uses,
    tree: {
      creatureId,
      counts: best.counts,
      left: materialize(catalog, picks[0].id, picks[0].packed, picks[0].bag),
      right: materialize(catalog, picks[1].id, picks[1].packed, picks[1].bag),
      ...(picks[2] ? { third: materialize(catalog, picks[2].id, picks[2].packed, picks[2].bag) } : {}),
    },
  };
}

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
  return paretoPacked([...found]);
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

function orderMixes(
  options: StarterOption[],
  catalog: Catalog,
  have: StarterCounts,
): StarterOption[] {
  const tiers = tierMap(catalog);
  return [...options].sort(
    (a, b) => compareUsage(a.uses, b.uses, tiers) || compareOptions(a, b, have),
  );
}

export function sortMixes(
  options: StarterOption[],
  catalog: Catalog,
  have: StarterCounts,
): StarterOption[] {
  return orderMixes(options, catalog, have);
}

function ownedResult(catalog: Catalog, creatureId: string): StarterOption {
  const counts = emptyCounts(catalog.starters);
  return {
    counts,
    shortfall: counts,
    affordable: true,
    path: null,
    uses: [creatureId],
    tree: { creatureId, counts, left: null, right: null, owned: true },
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
  const tiers = tierMap(catalog);
  const usable = owned.filter((id) => id !== creatureId && (tiers.get(id) ?? 0) > 1);
  const collapsed = adviseStarters(paths, ownCounts, have);
  const options = collapsed.map((source) =>
    coverSource(catalog, creatureId, source, have, usable, tiers),
  );
  if (owned.includes(creatureId)) options.push(ownedResult(catalog, creatureId));
  return orderMixes(options, catalog, have);
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
  | { status: "tier7"; comboCount: string; tier7Ids: string[] }
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

function summarizeTier7(
  creatureId: string,
  catalog: Catalog,
): { comboCount: string; tier7Ids: string[] } {
  const creatures = creatureMap(catalog.creatures);
  const recipesFor = recipesByResult(catalog.recipes);
  const memo = new Map<string, { ways: bigint; tier7: string[] }>();

  function walk(id: string, stack: string[]): { ways: bigint; tier7: string[] } {
    const cached = memo.get(id);
    if (cached) return cached;
    if (stack.includes(id)) return { ways: BigInt(0), tier7: [] };
    const current = creatures.get(id);
    if (!current || current.tier < 7) return { ways: BigInt(0), tier7: [] };
    if (current.tier === 7) {
      const leaf = { ways: BigInt(1), tier7: [id] };
      memo.set(id, leaf);
      return leaf;
    }
    const recipes = recipesFor.get(id) ?? [];
    let ways = BigInt(0);
    const tier7 = new Set<string>();
    const nextStack = [...stack, id];
    for (const recipe of recipes) {
      const slots = [recipe.parentA, recipe.parentB, ...(recipe.parentC ? [recipe.parentC] : [])];
      const parts = slots.map((slot) => walk(slot, nextStack));
      if (parts.some((part) => part.ways === BigInt(0))) continue;
      let product = BigInt(1);
      for (const part of parts) {
        product *= part.ways;
        for (const item of part.tier7) tier7.add(item);
      }
      ways += product;
    }
    const summary = { ways, tier7: [...tier7] };
    memo.set(id, summary);
    return summary;
  }

  const summary = walk(creatureId, []);
  const tier7Ids = summary.tier7
    .flatMap((id) => {
      const creature = creatures.get(id);
      return creature ? [creature] : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    .map((creature) => creature.id);
  return { comboCount: summary.ways.toString(), tier7Ids };
}

function collectBreakdown(creatureId: string, catalog: Catalog): Breakdown {
  const creatures = creatureMap(catalog.creatures);
  const creature = creatures.get(creatureId);
  if (!creature) return { status: "missing", creatureId };
  if (creature.tier >= 8) {
    const summary = summarizeTier7(creatureId, catalog);
    return { status: "tier7", comboCount: summary.comboCount, tier7Ids: summary.tier7Ids };
  }
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
