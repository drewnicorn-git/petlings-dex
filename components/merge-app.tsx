"use client";

import { useState } from "react";
import { CatalogProvider, useCatalog } from "@/components/catalog-context";
import { MergeBoard } from "@/components/board/merge-board";
import { DataTab } from "@/components/data/data-tab";
import { TierProgress } from "@/components/tier-progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FarmId } from "@/lib/farms";

function Notebook() {
  const { ready, farm, setFarm } = useCatalog();
  const [section, setSection] = useState<"board" | "data">("board");
  if (!ready) {
    return <p className="text-sm text-muted-foreground">Opening your notebook…</p>;
  }
  const tab = `${farm}-${section}`;
  return (
    <div>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (typeof value !== "string") return;
          const [nextFarm, nextSection] = value.split("-") as [FarmId, "board" | "data"];
          setFarm(nextFarm);
          setSection(nextSection);
        }}
      >
        <TabsList className="h-auto min-h-8 flex-wrap">
          <TabsTrigger value="land-board">Land Farm</TabsTrigger>
          <TabsTrigger value="sea-board">Sea Farm</TabsTrigger>
          <TabsTrigger value="land-data">Land Data</TabsTrigger>
          <TabsTrigger value="sea-data">Sea Data</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="pt-3">
        {section === "board" ? <MergeBoard key={farm} /> : <DataTab key={farm} />}
      </div>
    </div>
  );
}

export function MergeApp() {
  return (
    <CatalogProvider>
      <div className="min-h-svh">
        <header className="border-b px-4 py-4 sm:px-6">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Personal notebook
          </p>
          <h1 className="font-heading text-3xl">Merge Board</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Drag two creatures of the same tier together. A saved combo becomes the next
            creature. Tier 7, 8, and 9 wait for a third creature. Land Farm counts Chick, Bunny,
            and Cat. Sea Farm counts Clownfish, Seahorse, and Crab. Switching farms keeps each
            board&apos;s materials, missing combinations, and disassembly separate.
          </p>
          <TierProgress />
        </header>
        <main className="px-4 py-4 sm:px-6">
          <Notebook />
        </main>
      </div>
    </CatalogProvider>
  );
}
