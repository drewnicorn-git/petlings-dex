"use client";

import { CatalogProvider, useCatalog } from "@/components/catalog-context";
import { MergeBoard } from "@/components/board/merge-board";
import { DataTab } from "@/components/data/data-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function Notebook() {
  const { ready } = useCatalog();
  if (!ready) {
    return <p className="text-sm text-muted-foreground">Opening your notebook…</p>;
  }
  return (
    <Tabs defaultValue="board">
      <TabsList>
        <TabsTrigger value="board">Board</TabsTrigger>
        <TabsTrigger value="data">Data</TabsTrigger>
      </TabsList>
      <TabsContent value="board" className="pt-3">
        <MergeBoard />
      </TabsContent>
      <TabsContent value="data" className="pt-3">
        <DataTab />
      </TabsContent>
    </Tabs>
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
            creature. Drop one in the corner to count the Chick, Bunny, and Cat it takes.
          </p>
        </header>
        <main className="px-4 py-4 sm:px-6">
          <Notebook />
        </main>
      </div>
    </CatalogProvider>
  );
}
