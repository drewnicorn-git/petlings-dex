import { describe, expect, it } from "vitest";
import {
  adviseStarters,
  attemptMerge,
  attemptTriple,
  buildTree,
  disassemble,
  priceTree,
  rankMixes,
  expectedStarterTotal,
  findRecipe,
  isStarter,
  missingPartners,
  missingThirds,
  starterShortfall,
  totalCount,
  type BuildStep,
  validateRecipe,
  validateTierChange,
} from "@/lib/merge";
import { seedCatalog } from "@/lib/seed";
import { COLLECTION_TOTAL, collectionTotal, SEA_TIER_TOTALS, TIER_TOTALS } from "@/lib/tiers";
import type { Catalog, StarterCounts } from "@/lib/types";

function catalog(): Catalog {
  return structuredClone(seedCatalog);
}

describe("sea starters", () => {
  it("counts Clownfish and Seahorse instead of the land starters", () => {
    const sea: Catalog = {
      starters: ["clownfish", "seahorse", "crab"],
      creatures: [
        { id: "clownfish", name: "Clownfish", tier: 1, locked: true },
        { id: "seahorse", name: "Seahorse", tier: 1, locked: true },
        { id: "crab", name: "Crab", tier: 1, locked: true },
        { id: "reef", name: "Reef", tier: 2 },
      ],
      recipes: [{ id: "reef-pair", parentA: "clownfish", parentB: "seahorse", resultId: "reef" }],
    };
    expect(disassemble("reef", sea)).toMatchObject({
      status: "ok",
      total: 2,
      counts: { clownfish: 1, seahorse: 1, crab: 0 },
    });
    expect(disassemble("clownfish", sea)).toMatchObject({
      status: "ok",
      counts: { clownfish: 1, seahorse: 0, crab: 0 },
    });
  });
});

describe("collection totals", () => {
  it("matches the known roster size for each tier", () => {
    expect(TIER_TOTALS).toEqual({
      1: 3,
      2: 6,
      3: 21,
      4: 24,
      5: 25,
      6: 25,
      7: 23,
      8: 22,
      9: 19,
      10: 16,
    });
    expect(COLLECTION_TOTAL).toBe(184);
    expect(SEA_TIER_TOTALS).toEqual({
      1: 3,
      2: 6,
      3: 15,
      4: 19,
      5: 19,
      6: 17,
      7: 15,
      8: 13,
      9: 11,
      10: 9,
    });
    expect(collectionTotal("sea")).toBe(127);
  });
});

describe("adviseStarters", () => {
  const chicks = { recipeId: "chicks", parentA: "a", parentB: "a", counts: { chick: 8, bunny: 0, cat: 0 } };
  const mixed = { recipeId: "mixed", parentA: "b", parentB: "c", counts: { chick: 2, bunny: 2, cat: 4 } };

  it("picks an affordable mix that leans on the starter you have the most of", () => {
    const [best] = adviseStarters([mixed, chicks], chicks.counts, { chick: 10, bunny: 2, cat: 2 });
    expect(best.affordable).toBe(true);
    expect(best.path?.recipeId).toBe("chicks");
    expect(best.shortfall).toEqual({ chick: 0, bunny: 0, cat: 0 });
  });

  it("skips a mix you cannot afford", () => {
    const [best] = adviseStarters([chicks, mixed], chicks.counts, { chick: 2, bunny: 2, cat: 4 });
    expect(best.path?.recipeId).toBe("mixed");
    expect(best.affordable).toBe(true);
  });

  it("suggests the mix that needs the fewest extra starters", () => {
    const [best] = adviseStarters([mixed, chicks], chicks.counts, { chick: 1, bunny: 0, cat: 0 });
    expect(best.affordable).toBe(false);
    expect(best.path?.recipeId).toBe("chicks");
    expect(totalCount(best.shortfall)).toBe(7);
  });
});

function leafCounts(step: BuildStep): StarterCounts {
  if (!step.left || !step.right) return step.counts;
  const left = leafCounts(step.left);
  const right = leafCounts(step.right);
  return {
    chick: (left.chick ?? 0) + (right.chick ?? 0),
    bunny: (left.bunny ?? 0) + (right.bunny ?? 0),
    cat: (left.cat ?? 0) + (right.cat ?? 0),
  };
}

function assertBuild(step: BuildStep) {
  if (!step.left || !step.right) {
    expect(isStarter(step.creatureId)).toBe(true);
    expect(totalCount(step.counts)).toBe(1);
    return;
  }
  const recipe = findRecipe(seedCatalog.recipes, step.left.creatureId, step.right.creatureId);
  expect(recipe?.resultId).toBe(step.creatureId);
  assertBuild(step.left);
  assertBuild(step.right);
}

describe("buildTree", () => {
  it("expands a duck into two chicks", () => {
    const duck = disassemble("duck", seedCatalog);
    expect(duck.status).toBe("ok");
    if (duck.status !== "ok") return;
    const tree = buildTree(seedCatalog, "duck", duck.paths[0]);
    expect(tree).toMatchObject({
      creatureId: "duck",
      left: { creatureId: "chick", left: null, right: null },
      right: { creatureId: "chick", left: null, right: null },
    });
  });

  it("follows the chosen starter mix all the way down", () => {
    const hippo = disassemble("hippo", seedCatalog);
    expect(hippo.status).toBe("ok");
    if (hippo.status !== "ok") return;
    const path = hippo.paths.find(
      (item) => item.parentA === "frog" && item.parentB === "frog",
    );
    expect(path).toBeTruthy();
    if (!path) return;
    const tree = buildTree(seedCatalog, "hippo", path);
    expect(tree).not.toBeNull();
    if (!tree) return;
    expect(tree.left?.creatureId).toBe("frog");
    expect(tree.right?.creatureId).toBe("frog");
    expect(leafCounts(tree)).toEqual(path.counts);
    assertBuild(tree);
  });
});

describe("owned creatures", () => {
  function hippoFrog() {
    const hippo = disassemble("hippo", seedCatalog);
    expect(hippo.status).toBe("ok");
    if (hippo.status !== "ok") throw new Error("hippo");
    const path = hippo.paths.find((item) => item.parentA === "frog" && item.parentB === "frog");
    expect(path).toBeTruthy();
    if (!path) throw new Error("frog path");
    const tree = buildTree(seedCatalog, "hippo", path);
    if (!tree?.left || !tree.right) throw new Error("tree");
    return { hippo, path, tree: { ...tree, left: tree.left, right: tree.right } };
  }

  it("spends one owned frog and leaves the cheaper frog to build", () => {
    const { tree } = hippoFrog();
    const quote = priceTree(tree, ["frog"], { chick: 0, bunny: 0, cat: 0 });
    expect(quote.uses).toEqual(["frog"]);
    const ownedLeft = quote.step.left?.owned === true;
    const ownedRight = quote.step.right?.owned === true;
    expect(ownedLeft !== ownedRight).toBe(true);
    const remaining = ownedLeft ? quote.step.right : quote.step.left;
    expect(remaining?.owned).toBeUndefined();
    expect(quote.cost).toEqual(remaining?.counts);
    expect(totalCount(quote.cost)).toBe(
      Math.min(totalCount(tree.left.counts), totalCount(tree.right.counts)),
    );
  });

  it("treats an owned hippo as already made", () => {
    const { tree } = hippoFrog();
    const quote = priceTree(tree, ["hippo"], { chick: 0, bunny: 0, cat: 0 });
    expect(quote.cost).toEqual({ chick: 0, bunny: 0, cat: 0 });
    expect(quote.step.owned).toBe(true);
    expect(quote.step.left).toBeNull();
  });

  it("spends two copies when the same creature is added twice", () => {
    const { tree } = hippoFrog();
    const quote = priceTree(tree, ["frog", "frog"], { chick: 0, bunny: 0, cat: 0 });
    expect(quote.cost).toEqual({ chick: 0, bunny: 0, cat: 0 });
    expect(quote.uses).toEqual(["frog", "frog"]);
  });

  it("still spends owned copies when more than eight were added", () => {
    const { tree } = hippoFrog();
    const quote = priceTree(tree, Array.from({ length: 9 }, () => "frog"), {
      chick: 0,
      bunny: 0,
      cat: 0,
    });
    expect(quote.cost).toEqual({ chick: 0, bunny: 0, cat: 0 });
    expect(quote.uses).toEqual(["frog", "frog"]);
  });

  it("makes the frog mix cheaper once a frog is already owned", () => {
    const { hippo } = hippoFrog();
    const have = { chick: 20, bunny: 20, cat: 20 };
    const plain = adviseStarters(hippo.paths, hippo.counts, have);
    const ranked = rankMixes(seedCatalog, "hippo", hippo.paths, hippo.counts, have, ["frog"]);
    const frog = ranked.find((option) => option.path?.parentA === "frog" && option.path.parentB === "frog");
    const full = plain.find((option) => option.path?.parentA === "frog" && option.path.parentB === "frog");
    expect(frog?.uses).toEqual(["frog"]);
    expect(totalCount(frog?.counts ?? { chick: 0, bunny: 0, cat: 0 })).toBeLessThan(
      totalCount(full?.counts ?? { chick: 0, bunny: 0, cat: 0 }),
    );
  });

  it("keeps the sibling's best mix when an owned creature covers the other parent", () => {
    const have = { chick: 8, bunny: 3, cat: 0 };
    const anaconda = disassemble("anaconda", seedCatalog);
    expect(anaconda.status).toBe("ok");
    if (anaconda.status !== "ok") return;
    const ranked = rankMixes(seedCatalog, "anaconda", anaconda.paths, anaconda.counts, have, ["panther"]);
    const covered = ranked.find((option) => {
      const parents = [option.path?.parentA, option.path?.parentB];
      return parents.includes("panther") && parents.includes("snapping-turtle");
    });
    expect(covered?.uses).toEqual(["panther"]);
    const turtle = disassemble("snapping-turtle", seedCatalog);
    expect(turtle.status).toBe("ok");
    if (turtle.status !== "ok" || !covered?.tree) return;
    const [bestTurtle] = adviseStarters(turtle.paths, turtle.counts, have);
    expect(covered.counts).toEqual(bestTurtle.counts);
    const ownedNode = covered.tree.left?.owned ? covered.tree.left : covered.tree.right;
    const builtNode = covered.tree.left?.owned ? covered.tree.right : covered.tree.left;
    expect(ownedNode?.creatureId).toBe("panther");
    expect(ownedNode?.owned).toBe(true);
    expect(builtNode?.creatureId).toBe("snapping-turtle");
    expect(builtNode?.left && builtNode.right).toBeTruthy();
    if (builtNode) assertBuild(builtNode);
    expect(leafCounts(builtNode ?? covered.tree)).toEqual(bestTurtle.counts);
    const plain = rankMixes(seedCatalog, "anaconda", anaconda.paths, anaconda.counts, have, []);
    for (const option of ranked) {
      const raw = plain.find((item) => item.path?.recipeId === option.path?.recipeId);
      expect(raw).toBeTruthy();
      if (!raw) return;
      const ownedShort = totalCount(option.shortfall);
      const rawShort = totalCount(raw.shortfall);
      expect(ownedShort).toBeLessThanOrEqual(rawShort);
    }
  });

  it("keeps the same order when nothing extra is owned", () => {
    const { hippo } = hippoFrog();
    const have = { chick: 1, bunny: 0, cat: 0 };
    const ranked = rankMixes(seedCatalog, "hippo", hippo.paths, hippo.counts, have, []);
    const plain = adviseStarters(hippo.paths, hippo.counts, have);
    expect(ranked.map((option) => option.path?.recipeId)).toEqual(
      plain.map((option) => option.path?.recipeId),
    );
  });
});

describe("missingThirds", () => {
  it("lists every same-tier creature that does not finish the pair", () => {
    const board = catalog();
    board.recipes.push({
      id: "hydra-phoenix-dragon",
      parentA: "hydra",
      parentB: "phoenix",
      parentC: "dragon",
      resultId: "hydra",
    });
    const missing = missingThirds(board, "phoenix", "hydra").map((creature) => creature.id);
    expect(missing).not.toContain("dragon");
    expect(missing).toContain("hydra");
    expect(missing).toContain("phoenix");
    expect(missing).toContain("behemoth");
    expect(missingThirds(board, "chick", "bunny")).toEqual([]);
  });
});

describe("missingPartners", () => {
  it("lists every same-tier creature that has no saved combo, including itself", () => {
    for (const creature of seedCatalog.creatures) {
      const missing = new Set(missingPartners(seedCatalog, creature.id).map((partner) => partner.id));
      const sameTier = seedCatalog.creatures.filter((other) => other.tier === creature.tier);
      for (const other of sameTier) {
        const attempt = attemptMerge(seedCatalog, creature.id, other.id);
        if (creature.tier >= 7) {
          expect(missing.has(other.id)).toBe(false);
          expect(attempt).toEqual({
            ok: false,
            reason: creature.tier >= 10 ? "max-tier" : "needs-third",
          });
          continue;
        }
        if (missing.has(other.id)) {
          expect(attempt).toEqual({ ok: false, reason: "unknown" });
        } else {
          expect(attempt.ok).toBe(true);
        }
      }
    }
  });
});

describe("attemptMerge", () => {
  it("merges two chicks into a duck", () => {
    expect(attemptMerge(seedCatalog, "chick", "chick")).toEqual({
      ok: true,
      resultId: "duck",
    });
  });

  it("treats parent order as the same combo", () => {
    const recipe = findRecipe(seedCatalog.recipes, "bunny", "cat");
    expect(recipe?.resultId).toBe("arctic-fox");
  });

  it("rejects different tiers", () => {
    expect(attemptMerge(seedCatalog, "chick", "duck").ok).toBe(false);
    if (!attemptMerge(seedCatalog, "chick", "duck").ok) {
      expect(attemptMerge(seedCatalog, "chick", "duck")).toEqual({
        ok: false,
        reason: "same-tier",
      });
    }
  });

  it("reports an unknown same-tier pair", () => {
    const board = catalog();
    board.creatures.push(
      { id: "alpha", name: "Alpha", tier: 2 },
      { id: "beta", name: "Beta", tier: 2 },
    );
    expect(attemptMerge(board, "alpha", "beta")).toEqual({
      ok: false,
      reason: "unknown",
    });
  });

  it("asks for a third creature at tier 7 and saves that trio in any order", () => {
    expect(attemptMerge(seedCatalog, "hydra", "phoenix")).toEqual({
      ok: false,
      reason: "needs-third",
    });
    const board = catalog();
    board.creatures.push({ id: "colossus", name: "Colossus", tier: 8 });
    board.recipes.push({
      id: "hydra-phoenix-dragon",
      parentA: "phoenix",
      parentB: "dragon",
      parentC: "hydra",
      resultId: "colossus",
    });
    expect(attemptTriple(board, "hydra", "phoenix", "dragon")).toEqual({
      ok: true,
      resultId: "colossus",
    });
    expect(validateRecipe(board, "hydra", "phoenix", "colossus", undefined, "dragon")).toMatch(/already/);
    expect(validateRecipe(board, "hydra", "phoenix", "colossus")).toMatch(/third/);
  });

  it("counts a tier 8 as the three parents that make it", () => {
    const board = catalog();
    board.creatures.push(
      { id: "red", name: "Red", tier: 7 },
      { id: "green", name: "Green", tier: 7 },
      { id: "blue", name: "Blue", tier: 7 },
      { id: "prism", name: "Prism", tier: 8 },
    );
    board.recipes.push(
      { id: "duck-duck-red", parentA: "duck", parentB: "duck", resultId: "red" },
      { id: "bunny-bunny-red", parentA: "bunny", parentB: "bunny", resultId: "red" },
      { id: "cat-cat-green", parentA: "cat", parentB: "cat", resultId: "green" },
      { id: "bunny-bunny-blue", parentA: "bunny", parentB: "bunny", resultId: "blue" },
      {
        id: "rgb-prism",
        parentA: "red",
        parentB: "green",
        parentC: "blue",
        resultId: "prism",
      },
    );
    expect(disassemble("prism", board)).toEqual({
      status: "tier7",
      comboCount: "1",
      tier7Ids: ["blue", "green", "red"],
    });
  });

  it("refuses a tier 10 merge", () => {
    const board = catalog();
    board.creatures.push(
      { id: "nova", name: "Nova", tier: 10 },
      { id: "eclipse", name: "Eclipse", tier: 10 },
    );
    expect(attemptMerge(board, "nova", "eclipse")).toEqual({
      ok: false,
      reason: "max-tier",
    });
  });
});

describe("disassemble", () => {
  it("counts a duck as two chicks", () => {
    const result = disassemble("duck", seedCatalog);
    expect(result).toMatchObject({
      status: "ok",
      total: 2,
      counts: { chick: 2, bunny: 0, cat: 0 },
    });
  });

  it("counts a starter as itself", () => {
    expect(disassemble("bunny", seedCatalog)).toMatchObject({
      status: "ok",
      total: 1,
      counts: { chick: 0, bunny: 1, cat: 0 },
    });
  });

  it("adds both families for a cross merge", () => {
    const board = catalog();
    board.creatures.push(
      { id: "hare", name: "Hare", tier: 2 },
      { id: "mule", name: "Mule", tier: 3 },
    );
    board.recipes.push(
      { id: "bunny-bunny-hare", parentA: "bunny", parentB: "bunny", resultId: "hare" },
      { id: "duck-hare-mule", parentA: "duck", parentB: "hare", resultId: "mule" },
    );
    const result = disassemble("mule", board);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.counts).toEqual({ chick: 2, bunny: 2, cat: 0 });
      expect(result.total).toBe(expectedStarterTotal(3));
    }
  });

  it("lists each way when a creature has two recipes", () => {
    const board = catalog();
    board.creatures.push(
      { id: "kitten", name: "Kitten", tier: 2 },
      { id: "hare", name: "Hare", tier: 2 },
      { id: "gryphon", name: "Gryphon", tier: 3 },
    );
    board.recipes.push(
      { id: "cat-cat-kitten", parentA: "cat", parentB: "cat", resultId: "kitten" },
      { id: "bunny-bunny-hare", parentA: "bunny", parentB: "bunny", resultId: "hare" },
      { id: "duck-kitten", parentA: "duck", parentB: "kitten", resultId: "gryphon" },
      { id: "hare-kitten", parentA: "hare", parentB: "kitten", resultId: "gryphon" },
    );
    const result = disassemble("gryphon", board);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.paths).toHaveLength(2);
    expect(result.paths.map((path) => path.counts)).toEqual([
      { chick: 2, bunny: 0, cat: 2 },
      { chick: 0, bunny: 2, cat: 2 },
    ]);
    for (const path of result.paths) {
      expect(totalCount(path.counts)).toBe(4);
    }
  });

  it("keeps one best starter mix for each combo", () => {
    const anaconda = disassemble("anaconda", seedCatalog);
    expect(anaconda.status).toBe("ok");
    if (anaconda.status !== "ok") return;
    const recipes = seedCatalog.recipes.filter((recipe) => recipe.resultId === "anaconda");
    const have = { chick: 20, bunny: 4, cat: 0 };
    const options = adviseStarters(anaconda.paths, anaconda.counts, have);
    expect(options).toHaveLength(recipes.length);
    expect(options.length).toBeLessThan(anaconda.paths.length);
    for (const option of options) {
      const siblings = anaconda.paths.filter((path) => path.recipeId === option.path?.recipeId);
      const bestShort = totalCount(starterShortfall(option.counts, have));
      for (const sibling of siblings) {
        expect(bestShort).toBeLessThanOrEqual(totalCount(starterShortfall(sibling.counts, have)));
      }
    }
  });

  it("lists every way to make a creature", () => {
    const hippo = disassemble("hippo", seedCatalog);
    expect(hippo.status).toBe("ok");
    if (hippo.status !== "ok") return;
    expect(hippo.paths).toHaveLength(
      seedCatalog.recipes.filter((recipe) => recipe.resultId === "hippo").length,
    );
    for (const path of hippo.paths) {
      expect(totalCount(path.counts)).toBe(expectedStarterTotal(4));
    }

    const salamander = disassemble("giant-salamander", seedCatalog);
    expect(salamander.status).toBe("ok");
    if (salamander.status !== "ok") return;
    expect(salamander.paths.length).toBeGreaterThan(8);
    for (const path of salamander.paths) {
      expect(totalCount(path.counts)).toBe(expectedStarterTotal(5));
    }
  });

  it("counts a tiger as two cats", () => {
    expect(disassemble("tiger", seedCatalog)).toMatchObject({
      status: "ok",
      total: 2,
      counts: { chick: 0, bunny: 0, cat: 2 },
    });
  });

  it("counts registered tier 7 combinations for tier 8 and above", () => {
    const board = catalog();
    board.creatures.push(
      { id: "t8a", name: "Tide King", tier: 8 },
      { id: "t8b", name: "Storm King", tier: 8 },
      { id: "t9", name: "Sky King", tier: 9 },
      { id: "t8-empty", name: "Empty King", tier: 8 },
    );
    board.recipes.push(
      { id: "r1", parentA: "hydra", parentB: "phoenix", parentC: "dragon", resultId: "t8a" },
      { id: "r2", parentA: "hydra", parentB: "hydra", parentC: "behemoth", resultId: "t8a" },
      { id: "r3", parentA: "phoenix", parentB: "dragon", parentC: "griffin", resultId: "t8b" },
      { id: "r4", parentA: "t8a", parentB: "t8a", parentC: "t8b", resultId: "t9" },
    );
    expect(disassemble("t8a", board)).toEqual({
      status: "tier7",
      comboCount: "2",
      tier7Ids: ["behemoth", "dragon", "hydra", "phoenix"],
    });
    expect(disassemble("t9", board)).toEqual({
      status: "tier7",
      comboCount: "4",
      tier7Ids: ["behemoth", "dragon", "griffin", "hydra", "phoenix"],
    });
    expect(disassemble("t8-empty", board)).toEqual({
      status: "tier7",
      comboCount: "0",
      tier7Ids: [],
    });
  });

  it("names the creature that is missing a combo", () => {
    const board = catalog();
    board.creatures.push({ id: "orphan", name: "Orphan", tier: 2 });
    expect(disassemble("orphan", board)).toEqual({
      status: "missing",
      creatureId: "orphan",
    });
  });
});

describe("validateRecipe", () => {
  it("refuses a loop", () => {
    const board = catalog();
    board.creatures.push(
      { id: "alpha", name: "Alpha", tier: 2 },
      { id: "beta", name: "Beta", tier: 3 },
    );
    board.recipes.push({
      id: "beta-makes-alpha",
      parentA: "beta",
      parentB: "beta",
      resultId: "alpha",
    });
    expect(validateRecipe(board, "alpha", "alpha", "beta")).toBe(
      "That combo loops back on itself.",
    );
  });

  it("refuses a result that is not the next tier", () => {
    expect(validateRecipe(seedCatalog, "duck", "duck", "chick")).toBe(
      "The result has to be tier 3.",
    );
  });

  it("refuses a tier change that would break a combo", () => {
    expect(validateTierChange(seedCatalog, "duck", 3)).toMatch(/next-tier/);
    expect(validateTierChange(seedCatalog, "chick", 2)).toMatch(/stays at tier 1/);
  });
});
