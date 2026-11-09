import { describe, expect, it } from "vitest";
import {
  adviseStarters,
  attemptMerge,
  buildTree,
  disassemble,
  priceTree,
  rankMixes,
  expectedStarterTotal,
  findRecipe,
  isStarter,
  missingPartners,
  starterShortfall,
  totalCount,
  type BuildStep,
  validateRecipe,
  validateTierChange,
} from "@/lib/merge";
import { seedCatalog } from "@/lib/seed";
import { COLLECTION_TOTAL, TIER_TOTALS } from "@/lib/tiers";
import type { Catalog } from "@/lib/types";

function catalog(): Catalog {
  return structuredClone(seedCatalog);
}

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

function leafCounts(step: BuildStep): { chick: number; bunny: number; cat: number } {
  if (!step.left || !step.right) return step.counts;
  return {
    chick: leafCounts(step.left).chick + leafCounts(step.right).chick,
    bunny: leafCounts(step.left).bunny + leafCounts(step.right).bunny,
    cat: leafCounts(step.left).cat + leafCounts(step.right).cat,
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

describe("missingPartners", () => {
  it("lists every same-tier creature that has no saved combo, including itself", () => {
    for (const creature of seedCatalog.creatures) {
      const missing = new Set(missingPartners(seedCatalog, creature.id).map((partner) => partner.id));
      const sameTier = seedCatalog.creatures.filter((other) => other.tier === creature.tier);
      for (const other of sameTier) {
        const attempt = attemptMerge(seedCatalog, creature.id, other.id);
        if (creature.tier >= 10) {
          expect(missing.has(other.id)).toBe(false);
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
