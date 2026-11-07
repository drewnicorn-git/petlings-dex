import { describe, expect, it } from "vitest";
import {
  attemptMerge,
  disassemble,
  expectedStarterTotal,
  findRecipe,
  totalCount,
  validateRecipe,
  validateTierChange,
} from "@/lib/merge";
import { seedCatalog } from "@/lib/seed";
import type { Catalog } from "@/lib/types";

function catalog(): Catalog {
  return structuredClone(seedCatalog);
}

describe("attemptMerge", () => {
  it("merges two chicks into a duck", () => {
    expect(attemptMerge(seedCatalog, "chick", "chick")).toEqual({
      ok: true,
      resultId: "duck",
    });
  });

  it("treats parent order as the same combo", () => {
    const recipe = findRecipe(seedCatalog.recipes, "snapping-turtle", "panda");
    expect(recipe?.resultId).toBe("river-dragon");
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
    expect(attemptMerge(seedCatalog, "chick", "bunny")).toEqual({
      ok: false,
      reason: "unknown",
    });
  });

  it("refuses a tier 10 merge", () => {
    expect(attemptMerge(seedCatalog, "cosmic-dragon", "frost-sovereign")).toEqual({
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

  it("names the creature that is missing a combo", () => {
    expect(disassemble("tiger", seedCatalog)).toEqual({
      status: "missing",
      creatureId: "tiger",
    });
    expect(disassemble("river-dragon", seedCatalog)).toEqual({
      status: "missing",
      creatureId: "panda",
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
