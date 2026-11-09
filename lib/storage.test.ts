import { describe, expect, it } from "vitest";
import board from "@/data/merge-board.json";
import { seedCatalog } from "@/lib/seed";
import { catalogStamp, parseImport, resolveSavedCatalog } from "@/lib/storage";

describe("bundled catalog", () => {
  it("matches the committed merge-board export", () => {
    const parsed = parseImport(board);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.catalog.creatures.map((creature) => creature.id)).toEqual(
      seedCatalog.creatures.map((creature) => creature.id),
    );
    expect(parsed.catalog.recipes).toHaveLength(seedCatalog.recipes.length);
    expect(parsed.catalog.creatures).toHaveLength(104);
    expect(seedCatalog.recipes).toHaveLength(883);
    expect(parsed.catalog.creatures.some((creature) => "note" in creature)).toBe(false);
  });

  it("drops style, type, stats, and notes from an older export", () => {
    const parsed = parseImport({
      creatures: [
        {
          id: "chick",
          name: "Chick",
          tier: 1,
          note: "Published combo: Chick + Chick.",
          style: "Brawler",
          type: "Fire",
          hp: 12,
          atk: 3,
        },
        { id: "bunny", name: "Bunny", tier: 1 },
        { id: "cat", name: "Cat", tier: 1 },
      ],
      recipes: [],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.catalog.creatures[0]).toEqual({ id: "chick", name: "Chick", tier: 1, locked: true });
  });
});

describe("resolveSavedCatalog", () => {
  it("keeps browser edits until a new export is saved into the project", () => {
    const stamp = catalogStamp(seedCatalog);
    const local = structuredClone(seedCatalog);
    local.creatures.push({ id: "extra", name: "Extra", tier: 2 });
    const kept = resolveSavedCatalog({ catalog: local, sourceStamp: stamp }, seedCatalog, stamp);
    expect(kept.catalog.creatures.some((creature) => creature.id === "extra")).toBe(true);

    const replaced = resolveSavedCatalog(
      { catalog: local, sourceStamp: "previous-export" },
      seedCatalog,
      stamp,
    );
    expect(replaced.catalog.creatures.some((creature) => creature.id === "extra")).toBe(false);
    expect(replaced.sourceStamp).toBe(stamp);
  });

  it("uses the project file when this browser has no saved stamp", () => {
    const stamp = catalogStamp(seedCatalog);
    const chosen = resolveSavedCatalog(
      { catalog: { creatures: [], recipes: [] }, sourceStamp: undefined },
      seedCatalog,
      stamp,
    );
    expect(chosen.catalog.creatures).toHaveLength(seedCatalog.creatures.length);
  });
});
