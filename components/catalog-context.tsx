"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { FARM_IDS, type FarmId } from "@/lib/farms";
import {
  normalizeName,
  uniqueCreatureId,
  validateCreatureDraft,
  validateRecipe,
  validateTierChange,
} from "@/lib/merge";
import { bundledStampFor, freshCatalog, loadPersisted, savePersisted } from "@/lib/storage";
import type { BoardToken, Catalog, Creature, CreaturePatch, Recipe } from "@/lib/types";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

type FarmBucket = {
  catalog: Catalog;
  tokens: BoardToken[];
  sourceStamp: string;
};

type CatalogContextValue = {
  ready: boolean;
  farm: FarmId;
  setFarm: (farm: FarmId) => void;
  catalog: Catalog;
  tokens: BoardToken[];
  setTokens: Dispatch<SetStateAction<BoardToken[]>>;
  addCreature: (name: string, tier: number) => Result<Creature>;
  updateCreature: (id: string, patch: CreaturePatch) => Result<Creature>;
  deleteCreature: (id: string) => Result<null>;
  addRecipe: (parentA: string, parentB: string, resultId: string, parentC?: string) => Result<Recipe>;
  deleteRecipe: (id: string) => void;
  replaceCatalog: (catalog: Catalog) => void;
  resetCatalog: () => void;
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function initialBucket(farm: FarmId): FarmBucket {
  const catalog = freshCatalog(farm);
  return { catalog, tokens: [], sourceStamp: bundledStampFor(farm) };
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [farm, setFarm] = useState<FarmId>("land");
  const [farms, setFarms] = useState<Record<FarmId, FarmBucket>>({
    land: initialBucket("land"),
    sea: initialBucket("sea"),
  });
  const [ready, setReady] = useState(false);
  const farmRef = useRef(farm);
  const farmsRef = useRef(farms);
  farmRef.current = farm;
  farmsRef.current = farms;

  function commit(next: Catalog) {
    const id = farmRef.current;
    const updated = {
      ...farmsRef.current,
      [id]: { ...farmsRef.current[id], catalog: next },
    };
    farmsRef.current = updated;
    setFarms(updated);
  }

  const setTokens = useCallback((action: SetStateAction<BoardToken[]>) => {
    setFarms((current) => {
      const id = farmRef.current;
      const state = current[id];
      const tokens = typeof action === "function" ? action(state.tokens) : action;
      const updated = { ...current, [id]: { ...state, tokens } };
      farmsRef.current = updated;
      return updated;
    });
  }, []);

  useEffect(() => {
    const next = { land: initialBucket("land"), sea: initialBucket("sea") };
    for (const id of FARM_IDS) {
      const saved = loadPersisted(id);
      if (saved) {
        next[id] = {
          catalog: saved.catalog,
          tokens: saved.tokens,
          sourceStamp: saved.sourceStamp,
        };
      }
    }
    farmsRef.current = next;
    setFarms(next);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    for (const id of FARM_IDS) {
      const state = farms[id];
      savePersisted(state.catalog, state.tokens, state.sourceStamp, id);
    }
  }, [farms, ready]);

  const active = farms[farm];

  const value: CatalogContextValue = {
    ready,
    farm,
    setFarm,
    catalog: active.catalog,
    tokens: active.tokens,
    setTokens,
    addCreature(name, tier) {
      const current = farmsRef.current[farmRef.current].catalog;
      const error = validateCreatureDraft(current.creatures, name, tier);
      if (error) return { ok: false, error };
      const creature: Creature = {
        id: uniqueCreatureId(
          name,
          current.creatures.map((item) => item.id),
        ),
        name: normalizeName(name),
        tier,
      };
      commit({ ...current, creatures: [...current.creatures, creature] });
      return { ok: true, value: creature };
    },
    updateCreature(id, patch) {
      const current = farmsRef.current[farmRef.current].catalog;
      const existing = current.creatures.find((creature) => creature.id === id);
      if (!existing) return { ok: false, error: "That creature is not in the list." };
      const nextName = patch.name === undefined ? existing.name : normalizeName(patch.name);
      const nextTier = patch.tier ?? existing.tier;
      if (existing.locked && nextName.toLowerCase() !== existing.name.toLowerCase()) {
        return { ok: false, error: `${existing.name} keeps its name.` };
      }
      const nameError = validateCreatureDraft(current.creatures, nextName, existing.tier, id);
      if (nameError) return { ok: false, error: nameError };
      if (nextTier !== existing.tier) {
        const tierError = validateTierChange(current, id, nextTier);
        if (tierError) return { ok: false, error: tierError };
      }
      const creature: Creature = {
        id: existing.id,
        name: nextName,
        tier: nextTier,
        ...(existing.locked ? { locked: true } : {}),
      };
      commit({
        ...current,
        creatures: current.creatures.map((item) => (item.id === id ? creature : item)),
      });
      return { ok: true, value: creature };
    },
    deleteCreature(id) {
      const current = farmsRef.current[farmRef.current].catalog;
      const existing = current.creatures.find((creature) => creature.id === id);
      if (!existing) return { ok: false, error: "That creature is not in the list." };
      if (existing.locked) return { ok: false, error: `${existing.name} stays in the list.` };
      commit({
        ...current,
        creatures: current.creatures.filter((creature) => creature.id !== id),
        recipes: current.recipes.filter(
          (recipe) =>
            recipe.parentA !== id &&
            recipe.parentB !== id &&
            recipe.parentC !== id &&
            recipe.resultId !== id,
        ),
      });
      setTokens((currentTokens) => currentTokens.filter((token) => token.creatureId !== id));
      return { ok: true, value: null };
    },
    addRecipe(parentA, parentB, resultId, parentC) {
      const current = farmsRef.current[farmRef.current].catalog;
      const error = validateRecipe(current, parentA, parentB, resultId, undefined, parentC);
      if (error) return { ok: false, error };
      const recipe: Recipe = {
        id: newId("recipe"),
        parentA,
        parentB,
        ...(parentC ? { parentC } : {}),
        resultId,
      };
      commit({ ...current, recipes: [...current.recipes, recipe] });
      return { ok: true, value: recipe };
    },
    deleteRecipe(id) {
      const current = farmsRef.current[farmRef.current].catalog;
      commit({
        ...current,
        recipes: current.recipes.filter((recipe) => recipe.id !== id),
      });
    },
    replaceCatalog(next) {
      const id = farmRef.current;
      const stamped = { ...next, starters: farmsRef.current[id].catalog.starters };
      commit(stamped);
      setTokens((currentTokens) => {
        const ids = new Set(stamped.creatures.map((creature) => creature.id));
        return currentTokens.filter((token) => ids.has(token.creatureId));
      });
    },
    resetCatalog() {
      const id = farmRef.current;
      commit(freshCatalog(id));
      setTokens([]);
    },
  };

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogContextValue {
  const value = useContext(CatalogContext);
  if (!value) throw new Error("useCatalog must be used inside CatalogProvider");
  return value;
}
