"use client";

import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCatalog } from "@/components/catalog-context";
import { creatureName, findByName, normalizeName, sortCreatures } from "@/lib/merge";
import { exportPayload, parseImport } from "@/lib/storage";
import { tierStyle } from "@/lib/tiers";
import type { Creature } from "@/lib/types";

const NEW_RESULT = "__new__";

type EditDraft = {
  id: string;
  name: string;
  tier: string;
};

function draftFrom(creature: Creature): EditDraft {
  return {
    id: creature.id,
    name: creature.name,
    tier: String(creature.tier),
  };
}

export function DataTab() {
  const catalogApi = useCatalog();
  const { catalog } = catalogApi;
  const creatures = useMemo(() => sortCreatures(catalog.creatures), [catalog.creatures]);
  const [name, setName] = useState("");
  const [tier, setTier] = useState("2");
  const [creatureError, setCreatureError] = useState<string | null>(null);
  const [parentA, setParentA] = useState("");
  const [parentB, setParentB] = useState("");
  const [resultChoice, setResultChoice] = useState("");
  const [resultName, setResultName] = useState("");
  const [comboError, setComboError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditDraft | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Creature | null>(null);
  const [importText, setImportText] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parent = creatures.find((creature) => creature.id === parentA);
  const partners = parent
    ? creatures.filter((creature) => creature.tier === parent.tier)
    : [];
  const results = parent
    ? creatures.filter((creature) => creature.tier === parent.tier + 1)
    : [];

  function addCreature(event: FormEvent) {
    event.preventDefault();
    const result = catalogApi.addCreature(name, Number(tier));
    if (!result.ok) {
      setCreatureError(result.error);
      return;
    }
    setCreatureError(null);
    setName("");
  }

  function addCombo(event: FormEvent) {
    event.preventDefault();
    if (!parent) {
      setComboError("Pick the first creature.");
      return;
    }
    if (!parentB) {
      setComboError("Pick the second creature.");
      return;
    }
    let resultId = resultChoice;
    if (resultChoice === NEW_RESULT || !resultChoice) {
      const cleaned = normalizeName(resultName);
      const existing = findByName(catalog.creatures, cleaned);
      if (existing) {
        if (existing.tier !== parent.tier + 1) {
          setComboError(
            `${existing.name} is tier ${existing.tier}. This merge needs a tier ${parent.tier + 1} result.`,
          );
          return;
        }
        resultId = existing.id;
      } else {
        const created = catalogApi.addCreature(cleaned, parent.tier + 1);
        if (!created.ok) {
          setComboError(created.error);
          return;
        }
        resultId = created.value.id;
      }
    }
    const saved = catalogApi.addRecipe(parentA, parentB, resultId);
    if (!saved.ok) {
      setComboError(saved.error);
      return;
    }
    setComboError(null);
    setResultName("");
    setResultChoice("");
  }

  function saveEdit() {
    if (!editing) return;
    const result = catalogApi.updateCreature(editing.id, {
      name: editing.name,
      tier: Number(editing.tier),
    });
    if (!result.ok) {
      setEditError(result.error);
      return;
    }
    setEditing(null);
    setEditError(null);
  }

  function download() {
    const blob = new Blob([exportPayload(catalog)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "merge-board.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseImport(JSON.parse(String(reader.result)));
        if (!parsed.ok) {
          setImportError(parsed.error);
          setImportText(null);
          return;
        }
        setImportError(null);
        setImportText(JSON.stringify(parsed.catalog));
      } catch {
        setImportError("That file is not JSON.");
        setImportText(null);
      }
    };
    reader.readAsText(file);
  }

  const deleteCount = pendingDelete
    ? catalog.recipes.filter(
        (recipe) =>
          recipe.parentA === pendingDelete.id ||
          recipe.parentB === pendingDelete.id ||
          recipe.resultId === pendingDelete.id,
      ).length
    : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={addCreature} className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="font-heading text-lg">Add a creature</h2>
        <div className="space-y-1">
          <Label htmlFor="creature-name">Name</Label>
          <Input
            id="creature-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Snapping Turtle"
          />
        </div>
        <div className="space-y-1">
          <Label>Tier</Label>
          <Select value={tier} onValueChange={(value) => value && setTier(value)}>
            <SelectTrigger className="w-full" aria-label="Tier">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 9 }, (_, index) => String(index + 2)).map((value) => (
                <SelectItem key={value} value={value}>
                  Tier {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {creatureError ? <p className="text-sm text-destructive">{creatureError}</p> : null}
        <Button type="submit">Add creature</Button>
      </form>

      <form onSubmit={addCombo} className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="font-heading text-lg">Add a combo</h2>
        <p className="text-sm text-muted-foreground">
          Both parents have to share a tier. The result is the next tier.
        </p>
        <div className="space-y-1">
          <Label>First creature</Label>
          <Select
            value={parentA}
            onValueChange={(value) => {
              if (!value) return;
              setParentA(value);
              setParentB("");
              setResultChoice("");
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a creature" />
            </SelectTrigger>
            <SelectContent>
              {creatures.map((creature) => (
                <SelectItem key={creature.id} value={creature.id}>
                  {creature.name} · T{creature.tier}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Second creature</Label>
          <Select
            value={parentB}
            onValueChange={(value) => value && setParentB(value)}
            disabled={!parent}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={parent ? "Same tier" : "Pick the first creature"} />
            </SelectTrigger>
            <SelectContent>
              {partners.map((creature) => (
                <SelectItem key={creature.id} value={creature.id}>
                  {creature.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Result</Label>
          <Select
            value={resultChoice}
            onValueChange={(value) => value && setResultChoice(value)}
            disabled={!parent || parent.tier >= 10}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={parent ? `Tier ${parent.tier + 1}` : "Result"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NEW_RESULT}>Name a new creature</SelectItem>
              {results.map((creature) => (
                <SelectItem key={creature.id} value={creature.id}>
                  {creature.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {resultChoice === NEW_RESULT || resultChoice === "" ? (
          <div className="space-y-1">
            <Label htmlFor="result-name">New result name</Label>
            <Input
              id="result-name"
              value={resultName}
              onChange={(event) => setResultName(event.target.value)}
              placeholder={parent ? `Tier ${parent.tier + 1} name` : "Result name"}
            />
          </div>
        ) : null}
        {comboError ? <p className="text-sm text-destructive">{comboError}</p> : null}
        <Button type="submit">Save combo</Button>
      </form>

      <section className="space-y-3 rounded-2xl border bg-card p-4 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-lg">Saved list</h2>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={download}>
              Export
            </Button>
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
              Import
            </Button>
            <Button type="button" variant="outline" onClick={() => setResetOpen(true)}>
              Reset starter list
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onFile}
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          The copy kept with the project is <span className="font-medium">data/merge-board.json</span>.
          Export a newer file and replace that one when you add more creatures. The board picks up the
          new file the next time it loads.
        </p>
        {importError ? <p className="text-sm text-destructive">{importError}</p> : null}
        <ul className="grid gap-2 md:grid-cols-2">
          {creatures.map((creature) => {
            const colors = tierStyle(creature.tier);
            const isEditing = editing?.id === creature.id;
            return (
              <li key={creature.id} className="rounded-xl border p-3">
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      aria-label={`Name for ${creature.name}`}
                      value={editing.name}
                      disabled={creature.locked}
                      onChange={(event) =>
                        setEditing({ ...editing, name: event.target.value })
                      }
                    />
                    <Select
                      value={editing.tier}
                      onValueChange={(value) =>
                        value && setEditing({ ...editing, tier: value })
                      }
                      disabled={creature.locked}
                    >
                      <SelectTrigger className="w-full" aria-label="Edit tier">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(creature.locked ? ["1"] : Array.from({ length: 9 }, (_, index) => String(index + 2))).map(
                          (value) => (
                            <SelectItem key={value} value={value}>
                              Tier {value}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                    {editError ? <p className="text-sm text-destructive">{editError}</p> : null}
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={saveEdit}>
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(null);
                          setEditError(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-bold"
                          style={{ background: colors.bg, color: colors.fg }}
                        >
                          T{creature.tier}
                        </span>
                        <span className="truncate font-semibold">{creature.name}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(draftFrom(creature));
                          setEditError(null);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={creature.locked}
                        onClick={() => setPendingDelete(creature)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-2 rounded-2xl border bg-card p-4 lg:col-span-2">
        <h2 className="font-heading text-lg">Combos</h2>
        {catalog.recipes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No combos yet.</p>
        ) : (
          <ul className="space-y-2">
            {catalog.recipes.map((recipe) => (
              <li
                key={recipe.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
              >
                <span>
                  {creatureName(catalog, recipe.parentA)} + {creatureName(catalog, recipe.parentB)} ={" "}
                  <strong>{creatureName(catalog, recipe.resultId)}</strong>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => catalogApi.deleteRecipe(recipe.id)}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {pendingDelete?.name}?</DialogTitle>
            <DialogDescription>
              {deleteCount > 0
                ? `${pendingDelete?.name} is used in ${deleteCount} combo${deleteCount === 1 ? "" : "s"}. Deleting it removes those combos too.`
                : `${pendingDelete?.name} will leave the list in this browser.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (pendingDelete) catalogApi.deleteCreature(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importText !== null} onOpenChange={(open) => !open && setImportText(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace the current list?</DialogTitle>
            <DialogDescription>
              The creatures and combos in this browser will be replaced by the file.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportText(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!importText) return;
                const parsed = parseImport(JSON.parse(importText));
                if (parsed.ok) catalogApi.replaceCatalog(parsed.catalog);
                setImportText(null);
              }}
            >
              Replace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset the starter list?</DialogTitle>
            <DialogDescription>
              This restores the creature list saved in data/merge-board.json. Creatures and combos you added in this browser since that copy are removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                catalogApi.resetCatalog();
                setResetOpen(false);
              }}
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
