import { validateRecipe } from "@/lib/merge";
import { seedCatalog } from "@/lib/seed";
import {
  STARTER_IDS,
  STARTER_NAMES,
  type BoardToken,
  type Catalog,
  type Creature,
  type StarterId,
} from "@/lib/types";

const KEY = "petlings-merge-board-v1";

export type Persisted = {
  version: 1;
  catalog: Catalog;
  tokens: BoardToken[];
};

export function parseImport(
  data: unknown,
): { ok: true; catalog: Catalog } | { ok: false; error: string } {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "That file is not a merge board export." };
  }
  const record = data as { creatures?: unknown; recipes?: unknown };
  if (!Array.isArray(record.creatures) || !Array.isArray(record.recipes)) {
    return { ok: false, error: "That file is missing creatures or combos." };
  }

  const creatures: Creature[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  for (const raw of record.creatures) {
    if (!raw || typeof raw !== "object") {
      return { ok: false, error: "A creature in that file is incomplete." };
    }
    const item = raw as {
      id?: unknown;
      name?: unknown;
      tier?: unknown;
      note?: unknown;
    };
    if (typeof item.id !== "string" || typeof item.name !== "string") {
      return { ok: false, error: "A creature in that file is missing a name or id." };
    }
    if (typeof item.tier !== "number" || !Number.isInteger(item.tier)) {
      return { ok: false, error: `${item.name || "A creature"} has a bad tier.` };
    }
    const locked = (STARTER_IDS as readonly string[]).includes(item.id);
    const name = locked ? STARTER_NAMES[item.id as StarterId] : item.name.trim().replace(/\s+/g, " ");
    if (!name) return { ok: false, error: "A creature has a blank name." };
    if (item.tier < 1 || item.tier > 10) {
      return { ok: false, error: `${name} has a tier outside 1 to 10.` };
    }
    if (seenIds.has(item.id)) {
      return { ok: false, error: `${name} is listed more than once.` };
    }
    if (seenNames.has(name.toLowerCase())) {
      return { ok: false, error: `${name} is listed more than once.` };
    }
    seenIds.add(item.id);
    seenNames.add(name.toLowerCase());
    creatures.push({
      id: item.id,
      name,
      tier: locked ? 1 : item.tier,
      locked: locked || undefined,
      note: typeof item.note === "string" && item.note.trim() ? item.note.trim() : undefined,
    });
  }

  for (const id of STARTER_IDS) {
    if (!seenIds.has(id)) {
      return { ok: false, error: "The file needs Chick, Bunny, and Cat." };
    }
  }
  for (const creature of creatures) {
    if (creature.tier === 1 && !creature.locked) {
      return {
        ok: false,
        error: `${creature.name} is tier 1. Only Chick, Bunny, and Cat can be tier 1.`,
      };
    }
  }

  const catalog: Catalog = { creatures, recipes: [] };
  const recipeIds = new Set<string>();
  for (const raw of record.recipes) {
    if (!raw || typeof raw !== "object") {
      return { ok: false, error: "A combo in that file is incomplete." };
    }
    const item = raw as {
      id?: unknown;
      parentA?: unknown;
      parentB?: unknown;
      resultId?: unknown;
    };
    if (
      typeof item.parentA !== "string" ||
      typeof item.parentB !== "string" ||
      typeof item.resultId !== "string"
    ) {
      return { ok: false, error: "A combo in that file is incomplete." };
    }
    const error = validateRecipe(catalog, item.parentA, item.parentB, item.resultId);
    if (error) return { ok: false, error };
    const id =
      typeof item.id === "string" && item.id.trim() && !recipeIds.has(item.id)
        ? item.id
        : `recipe-${catalog.recipes.length + 1}`;
    recipeIds.add(id);
    catalog.recipes.push({
      id,
      parentA: item.parentA,
      parentB: item.parentB,
      resultId: item.resultId,
    });
  }

  return { ok: true, catalog };
}

function validToken(value: unknown, creatureIds: Set<string>): value is BoardToken {
  if (!value || typeof value !== "object") return false;
  const token = value as BoardToken;
  return (
    typeof token.id === "string" &&
    typeof token.creatureId === "string" &&
    creatureIds.has(token.creatureId) &&
    typeof token.x === "number" &&
    typeof token.y === "number"
  );
}

export function loadPersisted(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { catalog?: unknown; tokens?: unknown };
    const imported = parseImport(parsed.catalog ?? parsed);
    if (!imported.ok) return null;
    const ids = new Set(imported.catalog.creatures.map((creature) => creature.id));
    const tokens = Array.isArray(parsed.tokens)
      ? parsed.tokens.filter((token) => validToken(token, ids))
      : [];
    return { version: 1, catalog: imported.catalog, tokens };
  } catch {
    return null;
  }
}

export function savePersisted(catalog: Catalog, tokens: BoardToken[]): void {
  if (typeof window === "undefined") return;
  const payload: Persisted = { version: 1, catalog, tokens };
  window.localStorage.setItem(KEY, JSON.stringify(payload));
}

export function exportPayload(catalog: Catalog): string {
  return JSON.stringify({ version: 1, ...catalog }, null, 2);
}

export function freshCatalog(): Catalog {
  return structuredClone(seedCatalog);
}
