"use client";

import { useMemo, useState, type PointerEvent } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { sortCreatures } from "@/lib/merge";
import { TIERS, tierStyle } from "@/lib/tiers";
import type { Creature } from "@/lib/types";

export function Palette({
  creatures,
  onPointerDown,
}: {
  creatures: Creature[];
  onPointerDown: (event: PointerEvent<HTMLButtonElement>, creatureId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<number | "all">("all");
  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    return sortCreatures(creatures).filter((creature) => {
      if (tier !== "all" && creature.tier !== tier) return false;
      if (text && !creature.name.toLowerCase().includes(text)) return false;
      return true;
    });
  }, [creatures, query, tier]);

  return (
    <aside className="flex h-72 min-h-0 flex-col gap-3 lg:h-[calc(100svh-12.5rem)]">
      <div>
        <h2 className="font-heading text-lg">Creatures</h2>
        <p className="text-xs text-muted-foreground">Drag a name onto the board.</p>
      </div>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search names"
        aria-label="Search creatures"
      />
      <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by tier">
        <button
          type="button"
          aria-pressed={tier === "all"}
          onClick={() => setTier("all")}
          className="rounded-full border px-2 py-0.5 text-xs font-semibold aria-pressed:bg-foreground aria-pressed:text-background"
        >
          All
        </button>
        {TIERS.map((item) => (
          <button
            key={item.tier}
            type="button"
            aria-pressed={tier === item.tier}
            onClick={() => setTier(item.tier)}
            className="rounded-full px-2 py-0.5 text-xs font-bold aria-pressed:ring-2 aria-pressed:ring-foreground"
            style={{ background: item.bg, color: item.fg }}
          >
            {item.tier}
          </button>
        ))}
      </div>
      <ScrollArea className="min-h-0 flex-1 rounded-xl border bg-card/70">
        <ul className="flex flex-col gap-2 p-2">
          {visible.length === 0 ? (
            <li className="px-2 py-6 text-center text-sm text-muted-foreground">
              No creatures match.
            </li>
          ) : (
            visible.map((creature) => {
              const colors = tierStyle(creature.tier);
              return (
                <li key={creature.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold shadow-sm touch-none"
                    style={{ background: colors.bg, color: colors.fg }}
                    aria-label={`Drag ${creature.name}, tier ${creature.tier}`}
                    onPointerDown={(event) => onPointerDown(event, creature.id)}
                  >
                    <span className="w-5 shrink-0 text-center text-xs">{creature.tier}</span>
                    <span className="truncate">{creature.name}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </ScrollArea>
    </aside>
  );
}
