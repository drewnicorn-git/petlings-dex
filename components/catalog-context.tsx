"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  normalizeName,
  uniqueCreatureId,
  validateCreatureDraft,
  validateRecipe,
  validateTierChange,
} from "@/lib/merge";
import { readAttributes } from "@/lib/attributes";
import { bundledStamp, freshCatalog, loadPersisted, savePersisted } from "@/lib/storage";
import type { BoardToken, Catalog, Creature, CreaturePatch, Recipe } from "@/lib/types";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

type CatalogContextValue = {
  ready: boolean;
  catalog: Catalog;
  tokens: BoardToken[];
  setTokens: Dispatch<SetStateAction<BoardToken[]>>;
  addCreature: (name: string, tier: number) => Result<Creature>;
  updateCreature: (id: string, patch: CreaturePatch) => Result<Creature>;
  deleteCreature: (id: string) => Result<null>;
  addRecipe: (parentA: string, parentB: string, resultId: string) => Result<Recipe>;
  deleteRecipe: (id: string) => void;
  replaceCatalog: (catalog: Catalog) => void;
  resetCatalog: () => void;
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog>(freshCatalog);
  const [tokens, setTokens] = useState<BoardToken[]>([]);
  const [sourceStamp, setSourceStamp] = useState(bundledStamp);
  const [ready, setReady] = useState(false);
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;

  function commit(next: Catalog) {
    catalogRef.current = next;
    setCatalog(next);
  }

  useEffect(() => {
    const saved = loadPersisted();
    if (saved) {
      commit(saved.catalog);
      setTokens(saved.tokens);
      setSourceStamp(saved.sourceStamp);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    savePersisted(catalog, tokens, sourceStamp);
  }, [catalog, tokens, sourceStamp, ready]);

  const value: CatalogContextValue = {
    ready,
    catalog,
    tokens,
    setTokens,
    addCreature(name, tier) {
      const current = catalogRef.current;
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
      const current = catalogRef.current;
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
      const attributes = readAttributes(
        {
          style: patch.style === undefined ? existing.style : patch.style,
          type: patch.type === undefined ? existing.type : patch.type,
          hp: patch.hp === undefined ? existing.hp : patch.hp,
          atk: patch.atk === undefined ? existing.atk : patch.atk,
          def: patch.def === undefined ? existing.def : patch.def,
          spd: patch.spd === undefined ? existing.spd : patch.spd,
          rng: patch.rng === undefined ? existing.rng : patch.rng,
        },
        nextName,
      );
      if (!attributes.ok) return attributes;
      const creature: Creature = {
        id: existing.id,
        name: nextName,
        tier: nextTier,
        ...(existing.locked ? { locked: true } : {}),
        ...(existing.note ? { note: existing.note } : {}),
        ...attributes.value,
      };
      commit({
        ...current,
        creatures: current.creatures.map((item) => (item.id === id ? creature : item)),
      });
      return { ok: true, value: creature };
    },
    deleteCreature(id) {
      const current = catalogRef.current;
      const existing = current.creatures.find((creature) => creature.id === id);
      if (!existing) return { ok: false, error: "That creature is not in the list." };
      if (existing.locked) return { ok: false, error: `${existing.name} stays in the list.` };
      commit({
        creatures: current.creatures.filter((creature) => creature.id !== id),
        recipes: current.recipes.filter(
          (recipe) => recipe.parentA !== id && recipe.parentB !== id && recipe.resultId !== id,
        ),
      });
      setTokens((currentTokens) => currentTokens.filter((token) => token.creatureId !== id));
      return { ok: true, value: null };
    },
    addRecipe(parentA, parentB, resultId) {
      const current = catalogRef.current;
      const error = validateRecipe(current, parentA, parentB, resultId);
      if (error) return { ok: false, error };
      const recipe: Recipe = {
        id: newId("recipe"),
        parentA,
        parentB,
        resultId,
      };
      commit({ ...current, recipes: [...current.recipes, recipe] });
      return { ok: true, value: recipe };
    },
    deleteRecipe(id) {
      const current = catalogRef.current;
      commit({
        ...current,
        recipes: current.recipes.filter((recipe) => recipe.id !== id),
      });
    },
    replaceCatalog(next) {
      commit(next);
      setTokens((currentTokens) => {
        const ids = new Set(next.creatures.map((creature) => creature.id));
        return currentTokens.filter((token) => ids.has(token.creatureId));
      });
    },
    resetCatalog() {
      commit(freshCatalog());
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
