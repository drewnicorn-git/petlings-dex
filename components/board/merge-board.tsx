"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { CreatureArt } from "@/components/creature-art";
import { useCatalog } from "@/components/catalog-context";
import { Palette } from "@/components/board/palette";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select";
import { pickMergeTarget, type DropBox, type HitBox } from "@/lib/hit";
import {
  attemptMerge,
  attemptTriple,
  buildTree,
  creatureName,
  disassemble,
  firstOwnedBuild,
  autoGenerateThirds,
  findByName,
  missingPartners,
  uniqueCreatureId,
  validateCreatureDraft,
  validateRecipe,
  missingThirds,
  normalizeName,
  emptyCounts,
  materialFrontier,
  rankMixes,
  sortMixes,
  sortCreatures,
  type Breakdown,
  type BuildStep,
  type StarterOption,
} from "@/lib/merge";
import { starterListLabel, storageKey, type FarmId } from "@/lib/farms";
import { tierStyle } from "@/lib/tiers";
import { STARTER_NAMES, type BoardToken, type StarterCounts } from "@/lib/types";

const TOKEN_W = 112;
const TOKEN_H = 132;

function readStock(farm: FarmId, starters: readonly string[]): StarterCounts {
  const empty = emptyCounts(starters);
  if (typeof window === "undefined") return empty;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(farm, "stock")) ?? "") as Partial<StarterCounts>;
    for (const id of starters) empty[id] = wholeCount(parsed[id]);
    return empty;
  } catch {
    return empty;
  }
}

function wholeCount(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function ownedChoices(creatures: Parameters<typeof sortCreatures>[0]) {
  const groups = new Map<number, Parameters<typeof sortCreatures>[0]>();
  for (const creature of sortCreatures(creatures).filter((item) => item.tier > 1)) {
    const list = groups.get(creature.tier);
    if (list) list.push(creature);
    else groups.set(creature.tier, [creature]);
  }
  return [...groups.entries()].map(([tier, list]) => ({ tier, creatures: list }));
}

function ownedTally(ids: string[], creatures: Parameters<typeof sortCreatures>[0]) {
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const id of ids) {
    if (!counts.has(id)) order.push(id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return order.flatMap((id) => {
    const creature = creatures.find((item) => item.id === id);
    if (!creature || creature.tier <= 1) return [];
    return [{ id, name: creature.name, tier: creature.tier, count: counts.get(id) ?? 0 }];
  });
}

function readOwned(farm: FarmId): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(farm, "owned")) ?? "");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

function pieceLabel(
  id: string,
  catalog: ReturnType<typeof useCatalog>["catalog"],
): string {
  const creature = catalog.creatures.find((item) => item.id === id);
  return creature ? `${creature.name} (T${creature.tier})` : id;
}

function ownedPieces(option: StarterOption): string[] {
  if (!option.tree) return option.uses;
  return materialFrontier(option.tree)
    .filter((item) => item.owned)
    .map((item) => item.creatureId);
}

function PlanLines({
  option,
  catalog,
}: {
  option: StarterOption;
  catalog: ReturnType<typeof useCatalog>["catalog"];
}) {
  const have = ownedPieces(option);
  const starters = catalog.starters.filter((id) => (option.shortfall[id] ?? 0) > 0);
  return (
    <>
      {option.path ? (
        <p className="text-xs break-words">
          via {comboNames(catalog, [option.path.parentA, option.path.parentB, option.path.parentC])}
        </p>
      ) : null}
      {have.length > 0 ? (
        <p className="text-xs break-words">
          Use your {have.map((id) => pieceLabel(id, catalog)).join(", ")}.
        </p>
      ) : null}
      {starters.length === 0 ? (
        <p className="text-xs">No extra tier 1 pets.</p>
      ) : (
        <>
          <p className="text-xs">Still need</p>
          <ul className="mt-1 space-y-0.5">
            {starters.map((id) => (
              <li key={id}>
                {STARTER_NAMES[id] ?? id} × {option.shortfall[id]}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

type Drag =
  | { kind: "palette"; creatureId: string; pointerId: number }
  | {
      kind: "token";
      tokenId: string;
      creatureId: string;
      pointerId: number;
      dx: number;
      dy: number;
      originX: number;
      originY: number;
      partnerId?: string;
      partnerOriginX?: number;
      partnerOriginY?: number;
    };

type Mystery = {
  parentA: string;
  parentB: string;
  parentC?: string;
  tokenA: string;
  tokenB: string;
  tokenC?: string;
  x: number;
  y: number;
};

type PairBond = {
  id: string;
  tokenA: string;
  tokenB: string;
  parentA: string;
  parentB: string;
  tier: number;
};

type GapQuery = { kind: "one"; creatureId: string } | { kind: "pair"; parentA: string; parentB: string };

function comboNames(catalog: Parameters<typeof creatureName>[0], ids: Array<string | undefined>): string {
  return ids.filter((id): id is string => Boolean(id)).map((id) => creatureName(catalog, id)).join(" + ");
}

function newTokenId(): string {
  return `token-${crypto.randomUUID().slice(0, 8)}`;
}

function pointIn(rect: DOMRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function localPoint(board: HTMLElement, clientX: number, clientY: number) {
  const rect = board.getBoundingClientRect();
  return { x: clientX - rect.left + board.scrollLeft, y: clientY - rect.top + board.scrollTop };
}

function clampToken(board: HTMLElement, x: number, y: number) {
  const maxX = Math.max(8, board.clientWidth - TOKEN_W - 8);
  const maxY = Math.max(8, board.clientHeight - TOKEN_H - 8);
  return {
    x: Math.min(Math.max(8, x), maxX),
    y: Math.min(Math.max(8, y), maxY),
  };
}

function besideTarget(board: HTMLElement, target: BoardToken): { x: number; y: number } {
  const right = clampToken(board, target.x + TOKEN_W - 12, target.y);
  if (right.x > target.x + 48) return right;
  return clampToken(board, target.x - (TOKEN_W - 12), target.y);
}

function pairContaining(pairs: PairBond[], tokenId: string | undefined): PairBond | null {
  if (!tokenId) return null;
  return pairs.find((pair) => pair.tokenA === tokenId || pair.tokenB === tokenId) ?? null;
}


function BuildBranch({
  step,
  catalog,
}: {
  step: BuildStep;
  catalog: ReturnType<typeof useCatalog>["catalog"];
}) {
  const name = creatureName(catalog, step.creatureId);
  if (step.owned || !step.left || !step.right) {
    return (
      <p className="text-xs">
        {name}
        {step.owned ? " · already have" : ""}
      </p>
    );
  }
  return (
    <div>
      <p className="text-xs font-semibold">{name}</p>
      <p className="text-xs text-muted-foreground">
        {comboNames(catalog, [step.left.creatureId, step.right.creatureId, step.third?.creatureId])}
      </p>
      <div className="mt-1 ml-3 space-y-1 border-l border-foreground/15 pl-2">
        <BuildBranch step={step.left} catalog={catalog} />
        <BuildBranch step={step.right} catalog={catalog} />
        {step.third ? <BuildBranch step={step.third} catalog={catalog} /> : null}
      </div>
    </div>
  );
}

function StockField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: number;
  onChange: (next: number) => void;
}) {
  const name = STARTER_NAMES[id];
  return (
    <div className="flex items-center gap-1">
      <label htmlFor={`stock-${id}`} className="text-xs font-semibold">
        {name}
      </label>
      <Input
        id={`stock-${id}`}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={value}
        aria-label={`${name} count`}
        className="h-8 w-16 px-1.5 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        onChange={(event) => onChange(wholeCount(event.target.value))}
      />
      <div className="flex flex-col">
        <button
          type="button"
          className="flex size-4 items-center justify-center rounded-sm text-foreground hover:bg-muted"
          aria-label={`Add one ${name}`}
          onClick={() => onChange(value + 1)}
        >
          <ChevronUp className="size-3" />
        </button>
        <button
          type="button"
          className="flex size-4 items-center justify-center rounded-sm text-foreground hover:bg-muted disabled:opacity-40"
          aria-label={`Remove one ${name}`}
          disabled={value <= 0}
          onClick={() => onChange(value - 1)}
        >
          <ChevronDown className="size-3" />
        </button>
      </div>
    </div>
  );
}

function groupedCount(value: bigint): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function BreakdownView({
  creatureId,
  breakdown,
  have,
  owned,
}: {
  creatureId: string;
  breakdown: Breakdown | null;
  have: StarterCounts;
  owned: string[];
}) {
  const { catalog } = useCatalog();
  const creatureTier = catalog.creatures.find((item) => item.id === creatureId)?.tier ?? 0;
  const [tree, setTree] = useState<BuildStep | null>(null);
  const [treeOpen, setTreeOpen] = useState(false);
  const [covered, setCovered] = useState<StarterOption[] | null>(null);
  const [pending, setPending] = useState(false);
  const immediate = useMemo(() => {
    if (creatureTier >= 7 && owned.length > 0) {
      return firstOwnedBuild(catalog, creatureId, have, owned);
    }
    if (!breakdown || breakdown.status !== "ok") return null;
    if (owned.length > 0 && creatureTier < 7) return null;
    return rankMixes(catalog, creatureId, breakdown.paths, breakdown.counts, have, owned);
  }, [breakdown, catalog, creatureId, creatureTier, have, owned]);
  useEffect(() => {
    if (!breakdown || breakdown.status !== "ok" || owned.length === 0 || creatureTier >= 7) {
      setCovered(null);
      setPending(false);
      return;
    }
    const ready = breakdown;
    let cancelled = false;
    const groups = new Map<string, typeof ready.paths>();
    for (const path of ready.paths) {
      const list = groups.get(path.recipeId) ?? [];
      list.push(path);
      groups.set(path.recipeId, list);
    }
    const recipes = [...groups.values()];
    const found: StarterOption[] = [];
    let self: StarterOption | null = null;
    let index = 0;
    setPending(true);
    setCovered([]);
    function step() {
      if (cancelled) return;
      const group = recipes[index];
      index += 1;
      if (group) {
        const ranked = rankMixes(catalog, creatureId, group, ready.counts, have, owned);
        for (const option of ranked) {
          if (option.path) found.push(option);
          else self = option;
        }
        setCovered(sortMixes(found, catalog, have));
      }
      if (index < recipes.length) {
        timer = window.setTimeout(step, 0);
        return;
      }
      if (self) found.push(self);
      setCovered(sortMixes(found, catalog, have));
      setPending(false);
    }
    let timer = window.setTimeout(step, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [breakdown, catalog, creatureId, creatureTier, have, owned]);
  const options = immediate ?? covered ?? [];
  const searching = creatureTier < 7 && (pending || (owned.length > 0 && covered === null));
  const creature = catalog.creatures.find((item) => item.id === creatureId);
  if (!creature) return null;
  if (!breakdown && creatureTier !== 7) return null;
  if (breakdown?.status === "missing") {
    return (
      <p>
        {creatureName(catalog, breakdown.creatureId)} has no combo yet, so the starter count
        stops there.
      </p>
    );
  }
  if (breakdown?.status === "cycle") {
    return <p>This combo loops, so it can&apos;t be counted.</p>;
  }
  if (breakdown?.status === "not-starter") {
    return (
      <p>
        {creatureName(catalog, breakdown.creatureId)} is tier 1, but only {starterListLabel(catalog.starters)}
        can start a line.
      </p>
    );
  }
  if (breakdown?.status === "tier7") {
    const count = BigInt(breakdown.comboCount);
    const names = breakdown.tier7Ids.map((id) => ({
      id,
      name: creatureName(catalog, id),
    }));
    return (
      <div>
        <p className="text-xs">
          {groupedCount(count)} registered tier 7 {count === BigInt(1) ? "combination" : "combinations"}.
        </p>
        {names.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            No tier 7 creature is saved for this yet.
          </p>
        ) : (
          <>
            <p className="mt-2 text-xs text-muted-foreground">
              {names.length} unique tier 7 {names.length === 1 ? "creature" : "creatures"} can make it.
            </p>
            <ul className="mt-1 space-y-1">
              {names.map((item) => (
                <li key={item.id} className="text-xs break-words">
                  {item.name}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    );
  }
  if (breakdown && breakdown.status !== "ok") return null;
  const best = options[0];
  const listed = options.filter((option) => option.path);
  const fits = listed.filter((option) => option.affordable).length;
  const ways = listed.length;

  function openTree() {
    if (!best?.path) return;
    setTree(best.tree ?? buildTree(catalog, creatureId, best.path));
    setTreeOpen(true);
  }

  return (
    <div>
      {searching ? (
        <p className="text-xs text-muted-foreground">
          {options.length === 0 ? "Finding the best build…" : "Checking the other ways…"}
        </p>
      ) : null}
      {best ? (
        <div
          className={`mt-2 rounded-xl bg-muted px-2 py-1.5 ${best.path ? "cursor-pointer" : ""}`}
          onDoubleClick={openTree}
          title={best.path ? "Double-click for the full build" : undefined}
        >
          <p className="text-xs font-semibold">
            {creature.tier >= 7 && best.uses.length > 0
              ? "A build that uses what you have"
              : best.affordable
                ? "Best build you can make"
                : "Best build"}
          </p>
          {best.path || best.tree ? (
            <PlanLines option={best} catalog={catalog} />
          ) : (
            <p className="text-xs">This is a starter.</p>
          )}
          {best.path ? (
            <p className="text-xs text-muted-foreground">Double-click for the full build.</p>
          ) : null}
        </div>
      ) : null}
      <Dialog open={treeOpen} onOpenChange={setTreeOpen}>
        <DialogContent className="max-h-[min(32rem,80vh)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Build {creature.name}</DialogTitle>
            <DialogDescription>
              {best?.path
                ? `${comboNames(catalog, [best.path.parentA, best.path.parentB, best.path.parentC])}${
                    best.uses.length > 0
                      ? ". Pieces you already have stay closed."
                      : `, followed all the way to ${starterListLabel(catalog.starters)}.`
                  }`
                : "This creature is already a starter."}
            </DialogDescription>
          </DialogHeader>
          {tree ? <BuildBranch step={tree} catalog={catalog} /> : (
            <p className="text-sm text-muted-foreground">This mix cannot be traced to starters.</p>
          )}
        </DialogContent>
      </Dialog>
      <p className="mt-2 text-xs text-muted-foreground">
        {creature.tier >= 7 && best?.uses.length
          ? "Stopped at the first build that spends creatures you already own."
          : ways === 0
            ? searching
              ? "Looking through the saved ways."
              : "Starter"
            : `${fits} of ${ways} ${ways === 1 ? "way" : "ways"} fit what you have`}
      </p>
      {ways === 0 ? null : (
        options.map((option, index) =>
          option.path ? (
            <div
              key={`${option.path.recipeId}-${index}`}
              className={`mt-2 ${option.affordable ? "" : "opacity-60"}`}
            >
              <PlanLines option={option} catalog={catalog} />
              <p className="text-[10px] font-semibold tracking-wide uppercase">
                {option.affordable ? "Possible" : "Short"}
              </p>
            </div>
          ) : null,
        )
      )}
    </div>
  );
}

export function MergeBoard() {
  const api = useCatalog();
  const { catalog, tokens, setTokens, farm } = api;
  const starters = catalog.starters;
  const starterNames = starterListLabel(starters);
  const boardRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const gapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const apiRef = useRef(api);
  const tokensRef = useRef(tokens);
  apiRef.current = api;
  tokensRef.current = tokens;

  const [ghost, setGhost] = useState<{ x: number; y: number; creatureId: string } | null>(null);
  const [dockHot, setDockHot] = useState(false);
  const [gapHot, setGapHot] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [mystery, setMystery] = useState<Mystery | null>(null);
  const [pairs, setPairs] = useState<PairBond[]>([]);
  const pairsRef = useRef<PairBond[]>([]);
  pairsRef.current = pairs;
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusVersion, setFocusVersion] = useState(0);
  const [plan, setPlan] = useState<{ have: StarterCounts; owned: string[] } | null>(null);
  const [gapQuery, setGapQuery] = useState<GapQuery | null>(null);
  const [stock, setStock] = useState<StarterCounts>(() => emptyCounts(starters));
  const [owned, setOwned] = useState<string[]>([]);
  const stockRef = useRef(stock);
  const ownedRef = useRef(owned);
  stockRef.current = stock;
  ownedRef.current = owned;
  const stockFarm = useRef(farm);
  const [pickerKey, setPickerKey] = useState(0);
  const [stockReady, setStockReady] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [batchThirds, setBatchThirds] = useState<string[]>([]);
  const [nameError, setNameError] = useState<string | null>(null);
  const noticeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!stockReady || stockFarm.current !== farm) return;
    window.localStorage.setItem(storageKey(farm, "stock"), JSON.stringify(stock));
  }, [stock, farm, stockReady]);

  useEffect(() => {
    if (!stockReady || stockFarm.current !== farm) return;
    window.localStorage.setItem(storageKey(farm, "owned"), JSON.stringify(owned));
  }, [owned, farm, stockReady]);

  useEffect(() => {
    stockFarm.current = farm;
    setStock(readStock(farm, starters));
    setOwned(readOwned(farm));
    setMystery(null);
    setPairs([]);
    setFocusId(null);
    setPlan(null);
    setGapQuery(null);
    setStockReady(true);
  }, [farm, starters]);

  useEffect(() => {
    if (!stockReady) return;
    setOwned((current) => {
      const next = current.filter((id) => {
        const creature = catalog.creatures.find((item) => item.id === id);
        return creature !== undefined && creature.tier > 1;
      });
      if (next.length === current.length && next.every((id, index) => id === current[index])) return current;
      return next;
    });
  }, [catalog, stockReady]);

  function setStockCount(id: string, value: number) {
    setStock((current) => ({ ...current, [id]: value }));
  }

  const flash = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2200);
  }, []);

  const tokenBoxes = useCallback((): HitBox[] => {
    const board = boardRef.current;
    if (!board) return [];
    const creatures = new Map(
      apiRef.current.catalog.creatures.map((creature) => [creature.id, creature]),
    );
    const boxes: HitBox[] = [];
    for (const node of board.querySelectorAll<HTMLElement>("[data-token-id]")) {
      const id = node.dataset.tokenId;
      if (!id) continue;
      const token = tokensRef.current.find((item) => item.id === id);
      const creature = token ? creatures.get(token.creatureId) : undefined;
      if (!token || !creature) continue;
      const rect = node.getBoundingClientRect();
      boxes.push({
        id,
        tier: creature.tier,
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      });
    }
    return boxes;
  }, []);

  const dropOn = useCallback(
    (drag: Drag, clientX: number, clientY: number) => {
      const creature = apiRef.current.catalog.creatures.find(
        (item) => item.id === drag.creatureId,
      );
      if (!creature) return null;
      let drop: DropBox = {
        left: clientX - 36,
        top: clientY - 36,
        right: clientX + 36,
        bottom: clientY + 36,
      };
      if (drag.kind === "token") {
        const board = boardRef.current;
        const node = board?.querySelector<HTMLElement>(
          `[data-token-id="${CSS.escape(drag.tokenId)}"]`,
        );
        if (board && node) {
          const local = localPoint(board, clientX, clientY);
          const pos = clampToken(board, local.x - drag.dx, local.y - drag.dy);
          const boardRect = board.getBoundingClientRect();
          const width = node.getBoundingClientRect().width || TOKEN_W;
          const height = node.getBoundingClientRect().height || TOKEN_H;
          const left = boardRect.left - board.scrollLeft + pos.x;
          const top = boardRect.top - board.scrollTop + pos.y;
          drop = { left, top, right: left + width, bottom: top + height };
        }
      }
      const ignore = new Set<string>();
      if (drag.kind === "token") {
        ignore.add(drag.tokenId);
        if (drag.partnerId) ignore.add(drag.partnerId);
      }
      const targetId = pickMergeTarget(
        tokenBoxes().filter((box) => !ignore.has(box.id)),
        null,
        drop,
        creature.tier,
      );
      return targetId
        ? tokensRef.current.find((token) => token.id === targetId) ?? null
        : null;
    },
    [tokenBoxes],
  );

  const place = useCallback(
    (creatureId: string, x: number, y: number): string => {
      const id = newTokenId();
      setTokens((current) => [...current, { id, creatureId, x, y }]);
      return id;
    },
    [setTokens],
  );

  const snapBack = useCallback(
    (drag: Extract<Drag, { kind: "token" }>) => {
      setTokens((current) =>
        current.map((token) => {
          if (token.id === drag.tokenId) return { ...token, x: drag.originX, y: drag.originY };
          if (
            drag.partnerId &&
            token.id === drag.partnerId &&
            drag.partnerOriginX !== undefined &&
            drag.partnerOriginY !== undefined
          ) {
            return { ...token, x: drag.partnerOriginX, y: drag.partnerOriginY };
          }
          return token;
        }),
      );
    },
    [setTokens],
  );

  const finishMerge = useCallback(
    (resultId: string, removeIds: string[], x: number, y: number) => {
      setTokens((current) => {
        const next = current.filter((token) => !removeIds.includes(token.id));
        next.push({ id: newTokenId(), creatureId: resultId, x, y });
        return next;
      });
      setPairs((current) =>
        current.filter((pair) => !removeIds.includes(pair.tokenA) && !removeIds.includes(pair.tokenB)),
      );
      setMystery(null);
    },
    [setTokens],
  );

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      event.preventDefault();
      if (drag.kind === "palette") {
        setGhost({ x: event.clientX, y: event.clientY, creatureId: drag.creatureId });
      }
      const dock = dockRef.current;
      const gap = gapRef.current;
      setDockHot(!!dock && pointIn(dock.getBoundingClientRect(), event.clientX, event.clientY));
      setGapHot(!!gap && pointIn(gap.getBoundingClientRect(), event.clientX, event.clientY));
      if (drag.kind !== "token") return;
      const board = boardRef.current;
      if (!board) return;
      const local = localPoint(board, event.clientX, event.clientY);
      const pos = clampToken(board, local.x - drag.dx, local.y - drag.dy);
      let partnerPos: { x: number; y: number } | null = null;
      if (
        drag.partnerId &&
        drag.partnerOriginX !== undefined &&
        drag.partnerOriginY !== undefined
      ) {
        const rawX = drag.partnerOriginX + (pos.x - drag.originX);
        const rawY = drag.partnerOriginY + (pos.y - drag.originY);
        const clamped = clampToken(board, rawX, rawY);
        pos.x += clamped.x - rawX;
        pos.y += clamped.y - rawY;
        partnerPos = clamped;
      }
      setTokens((current) =>
        current.map((token) => {
          if (token.id === drag.tokenId) return { ...token, ...pos };
          if (partnerPos && token.id === drag.partnerId) return { ...token, ...partnerPos };
          return token;
        }),
      );
    };

    const up = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      setGhost(null);
      setDockHot(false);
      setGapHot(false);
      const board = boardRef.current;
      const dock = dockRef.current;
      const gap = gapRef.current;
      if (!board) return;
      const overGap = !!gap && pointIn(gap.getBoundingClientRect(), event.clientX, event.clientY);
      const overDock = !!dock && pointIn(dock.getBoundingClientRect(), event.clientX, event.clientY);
      const overBoard = pointIn(board.getBoundingClientRect(), event.clientX, event.clientY);

      if (drag.kind === "palette") {
        if (overGap) {
          setGapQuery({ kind: "one", creatureId: drag.creatureId });
          return;
        }
        if (overDock) {
          setFocusId(drag.creatureId);
          setPlan({ have: { ...stockRef.current }, owned: [...ownedRef.current] });
          setFocusVersion((version) => version + 1);
          return;
        }
        const hit = dropOn(drag, event.clientX, event.clientY);
        if (hit) {
          combine(drag.creatureId, null, hit, event.clientX, event.clientY);
          return;
        }
        if (overBoard) {
          const local = localPoint(board, event.clientX, event.clientY);
          const pos = clampToken(board, local.x - TOKEN_W / 2, local.y - 40);
          place(drag.creatureId, pos.x, pos.y);
        }
        return;
      }

      const token = tokensRef.current.find((item) => item.id === drag.tokenId);
      if (!token) return;
      if (overGap) {
        const pending = pairContaining(pairsRef.current, drag.tokenId);
        setGapQuery(
          pending
            ? { kind: "pair", parentA: pending.parentA, parentB: pending.parentB }
            : { kind: "one", creatureId: token.creatureId },
        );
        snapBack(drag);
        return;
      }
      if (overDock) {
        setFocusId(token.creatureId);
        setPlan({ have: { ...stockRef.current }, owned: [...ownedRef.current] });
        setFocusVersion((version) => version + 1);
        snapBack(drag);
        return;
      }
      const hit = dropOn(drag, event.clientX, event.clientY);
      if (hit) {
        combine(drag.creatureId, drag, hit, event.clientX, event.clientY);
        return;
      }
    };

    function combine(
      incomingId: string,
      drag: Extract<Drag, { kind: "token" }> | null,
      target: BoardToken,
      clientX: number,
      clientY: number,
    ) {
      const board = boardRef.current;
      if (!board) return;
      const catalogNow = apiRef.current.catalog;
      const incoming = catalogNow.creatures.find((creature) => creature.id === incomingId);
      const targetCreature = catalogNow.creatures.find((creature) => creature.id === target.creatureId);
      if (!incoming || !targetCreature) return;
      if (incoming.tier !== targetCreature.tier) {
        flash("Same tier only");
        if (drag) snapBack(drag);
        return;
      }
      if (incoming.tier >= 10) {
        flash("Tier 10 is the top. Those two can't merge higher.");
        if (drag) snapBack(drag);
        return;
      }
      if (incoming.tier >= 7) {
        const bonds = pairsRef.current;
        const incomingToken = drag?.tokenId;
        const incomingPair = pairContaining(bonds, incomingToken);
        const targetPair = pairContaining(bonds, target.id);
        if (incomingPair && targetPair && incomingPair.id === targetPair.id) return;
        if (incomingPair && targetPair) {
          flash("Drop one creature on a locked pair");
          if (drag) snapBack(drag);
          return;
        }
        const pending = incomingPair ?? targetPair;
        if (pending && incoming.tier === pending.tier) {
          const thirdId = incomingPair ? target.creatureId : incomingId;
          let tokenC = incomingPair ? target.id : incomingToken;
          if (drag) snapBack(drag);
          if (!tokenC) {
            const pos = clampToken(board, target.x, target.y - TOKEN_H - 8);
            tokenC = place(incomingId, pos.x, pos.y);
          }
          const attempt = attemptTriple(catalogNow, pending.parentA, pending.parentB, thirdId);
          if (attempt.ok) {
            finishMerge(attempt.resultId, [pending.tokenA, pending.tokenB, tokenC], target.x, target.y);
            return;
          }
          const local = localPoint(board, clientX, clientY);
          setMystery({
            parentA: pending.parentA,
            parentB: pending.parentB,
            parentC: thirdId,
            tokenA: pending.tokenA,
            tokenB: pending.tokenB,
            tokenC,
            x: local.x,
            y: local.y,
          });
          return;
        }
        const spot = besideTarget(board, target);
        let tokenA = incomingToken;
        if (drag) {
          setTokens((current) =>
            current.map((token) => (token.id === drag.tokenId ? { ...token, ...spot } : token)),
          );
        } else {
          tokenA = place(incomingId, spot.x, spot.y);
        }
        if (!tokenA) return;
        setMystery(null);
        setPairs((current) => [
          ...current.filter(
            (pair) =>
              pair.tokenA !== tokenA &&
              pair.tokenB !== tokenA &&
              pair.tokenA !== target.id &&
              pair.tokenB !== target.id,
          ),
          {
            id: `pair-${crypto.randomUUID().slice(0, 8)}`,
            tokenA,
            tokenB: target.id,
            parentA: incomingId,
            parentB: target.creatureId,
            tier: incoming.tier,
          },
        ]);
        return;
      }
      const attempt = attemptMerge(catalogNow, incomingId, target.creatureId);
      if (!attempt.ok && attempt.reason === "same-tier") {
        flash("Same tier only");
        if (drag) snapBack(drag);
        return;
      }
      if (!attempt.ok && attempt.reason === "max-tier") {
        flash("Tier 10 is the top. Those two can't merge higher.");
        if (drag) snapBack(drag);
        return;
      }
      if (attempt.ok) {
        finishMerge(attempt.resultId, [target.id, drag?.tokenId ?? ""], target.x, target.y);
        return;
      }
      let tokenA = drag?.tokenId;
      if (drag) snapBack(drag);
      if (!tokenA) {
        const pos = clampToken(board, target.x + TOKEN_W + 12, target.y);
        tokenA = place(incomingId, pos.x, pos.y);
      }
      const local = localPoint(board, clientX, clientY);
      setMystery({
        parentA: incomingId,
        parentB: target.creatureId,
        tokenA,
        tokenB: target.id,
        x: local.x,
        y: local.y,
      });
    }

    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dropOn, finishMerge, flash, place, setTokens, snapBack]);

  useEffect(() => {
    if (!mystery) return;
    const ids = new Set(tokens.map((token) => token.id));
    if (
      !ids.has(mystery.tokenA) ||
      !ids.has(mystery.tokenB) ||
      (mystery.tokenC !== undefined && !ids.has(mystery.tokenC))
    ) {
      setMystery(null);
    }
  }, [mystery, tokens]);

  useEffect(() => {
    setPairs((current) => {
      if (current.length === 0) return current;
      const ids = new Set(tokens.map((token) => token.id));
      const next = current.filter((pair) => ids.has(pair.tokenA) && ids.has(pair.tokenB));
      return next.length === current.length ? current : next;
    });
  }, [tokens]);

  function startPaletteDrag(event: React.PointerEvent<HTMLButtonElement>, creatureId: string) {
    if (event.button !== 0) return;
    dragRef.current = { kind: "palette", creatureId, pointerId: event.pointerId };
    setGhost({ x: event.clientX, y: event.clientY, creatureId });
  }

  function startTokenDrag(event: React.PointerEvent<HTMLDivElement>, token: BoardToken) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const board = boardRef.current;
    if (!board) return;
    const local = localPoint(board, event.clientX, event.clientY);
    const pending = pairContaining(pairsRef.current, token.id);
    const partnerId = pending ? (pending.tokenA === token.id ? pending.tokenB : pending.tokenA) : undefined;
    const partner = partnerId ? tokensRef.current.find((item) => item.id === partnerId) : undefined;
    dragRef.current = {
      kind: "token",
      tokenId: token.id,
      creatureId: token.creatureId,
      pointerId: event.pointerId,
      dx: local.x - token.x,
      dy: local.y - token.y,
      originX: token.x,
      originY: token.y,
      ...(partner
        ? { partnerId: partner.id, partnerOriginX: partner.x, partnerOriginY: partner.y }
        : {}),
    };
  }

  function saveDiscovery() {
    if (!mystery) return;
    const parent = catalog.creatures.find((creature) => creature.id === mystery.parentA);
    if (!parent) return;
    const tier = parent.tier + 1;
    const cleaned = normalizeName(draftName);
    const existing = findByName(catalog.creatures, cleaned);
    let resultId = existing?.id;
    if (existing && existing.tier !== tier) {
      setNameError(
        `${existing.name} is tier ${existing.tier}. This merge needs a tier ${tier} result.`,
      );
      return;
    }
    if (!existing) {
      const created = api.addCreature(cleaned, tier);
      if (!created.ok) {
        setNameError(created.error);
        return;
      }
      resultId = created.value.id;
    }
    if (!resultId) return;
    const saved = api.addRecipe(mystery.parentA, mystery.parentB, resultId, mystery.parentC);
    if (!saved.ok) {
      setNameError(saved.error);
      return;
    }
    const anchor =
      tokens.find((token) => token.id === mystery.tokenB) ??
      tokens.find((token) => token.id === mystery.tokenA);
    finishMerge(
      resultId,
      [mystery.tokenA, mystery.tokenB, ...(mystery.tokenC ? [mystery.tokenC] : [])],
      anchor?.x ?? 24,
      anchor?.y ?? 24,
    );
    setNameOpen(false);
    setDraftName("");
    setBatchThirds([]);
    setNameError(null);
  }

  function openNaming() {
    setDraftName("");
    setNameError(null);
    if (autoGenerate && mystery?.parentC) {
      setBatchThirds(
        autoGenerateThirds(catalog, mystery.parentA, mystery.parentB, mystery.parentC).map(
          (creature) => creature.id,
        ),
      );
    } else {
      setBatchThirds([]);
    }
    setNameOpen(true);
  }

  function saveBatch() {
    if (!mystery?.parentC) return;
    const parent = catalog.creatures.find((creature) => creature.id === mystery.parentA);
    if (!parent) return;
    const tier = parent.tier + 1;
    const cleaned = normalizeName(draftName);
    if (!cleaned) {
      setNameError("Give the creature a name.");
      return;
    }
    const existing = findByName(catalog.creatures, cleaned);
    if (existing && existing.tier !== tier) {
      setNameError(`${existing.name} is tier ${existing.tier}. This merge needs a tier ${tier} result.`);
      return;
    }
    let draft = catalog;
    let resultId = existing?.id;
    if (!existing) {
      const nameError = validateCreatureDraft(draft.creatures, cleaned, tier);
      if (nameError) {
        setNameError(nameError);
        return;
      }
      resultId = uniqueCreatureId(
        cleaned,
        draft.creatures.map((creature) => creature.id),
      );
      draft = {
        ...draft,
        creatures: [...draft.creatures, { id: resultId, name: cleaned, tier }],
      };
    }
    if (!resultId) return;
    for (const thirdId of batchThirds) {
      const recipeError = validateRecipe(
        draft,
        mystery.parentA,
        mystery.parentB,
        resultId,
        undefined,
        thirdId,
      );
      if (recipeError) {
        setNameError(`${creatureName(catalog, thirdId)}: ${recipeError}`);
        return;
      }
      draft = {
        ...draft,
        recipes: [
          ...draft.recipes,
          {
            id: `pending-${thirdId}`,
            parentA: mystery.parentA,
            parentB: mystery.parentB,
            parentC: thirdId,
            resultId,
          },
        ],
      };
    }
    let savedId = resultId;
    if (!existing) {
      const created = api.addCreature(cleaned, tier);
      if (!created.ok) {
        setNameError(created.error);
        return;
      }
      savedId = created.value.id;
    }
    for (const thirdId of batchThirds) {
      const saved = api.addRecipe(mystery.parentA, mystery.parentB, savedId, thirdId);
      if (!saved.ok) {
        setNameError(saved.error);
        return;
      }
    }
    if (mystery.tokenC) {
      const third = tokens.find((token) => token.id === mystery.tokenC);
      finishMerge(savedId, [mystery.tokenC], third?.x ?? 24, third?.y ?? 24);
    } else {
      setMystery(null);
    }
    setNameOpen(false);
    setDraftName("");
    setBatchThirds([]);
    setNameError(null);
  }

  const focus = focusId ? catalog.creatures.find((creature) => creature.id === focusId) : null;
  const dockOwned = plan?.owned ?? owned;
  const breakdown =
    focusId && !(focus && focus.tier === 7 && dockOwned.length > 0)
      ? disassemble(focusId, catalog)
      : null;
  const ghostCreature = ghost
    ? catalog.creatures.find((creature) => creature.id === ghost.creatureId)
    : null;
  const mysteryParents = mystery
    ? comboNames(catalog, [mystery.parentA, mystery.parentB, mystery.parentC])
    : "";
  const lockedPairLabel = mystery ? comboNames(catalog, [mystery.parentA, mystery.parentB]) : "";

  const gapCreature =
    gapQuery?.kind === "one"
      ? catalog.creatures.find((creature) => creature.id === gapQuery.creatureId) ?? null
      : null;
  const gapPair =
    gapQuery?.kind === "pair"
      ? {
          parentA: catalog.creatures.find((creature) => creature.id === gapQuery.parentA) ?? null,
          parentB: catalog.creatures.find((creature) => creature.id === gapQuery.parentB) ?? null,
        }
      : null;
  const gaps = gapCreature ? missingPartners(catalog, gapCreature.id) : [];
  const gapThirds =
    gapPair?.parentA && gapPair.parentB
      ? missingThirds(catalog, gapPair.parentA.id, gapPair.parentB.id)
      : [];

  function clearBoard() {
    dragRef.current = null;
    setGhost(null);
    setMystery(null);
    setPairs([]);
    setTokens([]);
  }

  const batchOpen = batchThirds.length > 0;

  return (
    <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
      <Palette creatures={catalog.creatures} onPointerDown={startPaletteDrag} />
      <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-wrap items-end gap-3">
          <p className="pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            You have
          </p>
          {starters.map((id) => (
            <StockField
              key={id}
              id={id}
              value={stock[id]}
              onChange={(value) => setStockCount(id, value)}
            />
          ))}
          <Select
            key={pickerKey}
            onValueChange={(value) => {
              if (typeof value !== "string" || value.length === 0) return;
              setOwned((current) => [...current, value]);
              setPickerKey((current) => current + 1);
            }}
          >
            <SelectTrigger
              aria-label="Add a creature you already have"
              className="size-8 justify-center px-0 pl-0 pr-0 [&_svg:nth-of-type(2)]:hidden"
            >
              <Plus className="size-4" />
            </SelectTrigger>
            <SelectContent align="start" className="max-h-80">
              {ownedChoices(catalog.creatures).map((group) => (
                <SelectGroup key={group.tier}>
                  <SelectLabel style={{ color: tierStyle(group.tier).bg }}>
                    Tier {group.tier}
                  </SelectLabel>
                  {group.creatures.map((creature) => {
                    const colors = tierStyle(creature.tier);
                    return (
                      <SelectItem
                        key={creature.id}
                        value={creature.id}
                        style={{ backgroundColor: colors.bg, color: colors.fg }}
                      >
                        {creature.name}
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          {ownedTally(owned, catalog.creatures).map((chip) => {
            const colors = tierStyle(chip.tier);
            return (
              <button
                key={chip.id}
                type="button"
                className="mb-0.5 inline-flex h-8 items-center rounded-full px-2 text-xs font-semibold"
                style={{ backgroundColor: colors.bg, color: colors.fg }}
                aria-label={`Remove one ${chip.name}`}
                onClick={() =>
                  setOwned((current) => {
                    const index = current.lastIndexOf(chip.id);
                    if (index < 0) return current;
                    return current.filter((_, item) => item !== index);
                  })
                }
              >
                {chip.name}
                {chip.count > 1 ? ` × ${chip.count}` : ""}
              </button>
            );
          })}
          <button
            type="button"
            className="mb-0.5 flex size-8 items-center justify-center rounded-lg border border-input text-foreground hover:bg-muted disabled:opacity-40"
            aria-label="Remove all added creatures"
            disabled={owned.length === 0}
            onClick={() => setOwned([])}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border px-2.5 py-1">
            <span className="text-xs font-semibold">Auto-Generate</span>
            <button
              type="button"
              role="switch"
              aria-checked={autoGenerate}
              aria-label="Auto-Generate"
              onClick={() => setAutoGenerate((on) => !on)}
              className={`relative h-5 w-9 rounded-full transition-colors ${autoGenerate ? "bg-primary" : "bg-muted"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-background shadow transition-transform ${autoGenerate ? "translate-x-4" : ""}`}
              />
            </button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={tokens.length === 0}
            onClick={clearBoard}
          >
            Clear all
          </Button>
        </div>
      </div>
      <div
        ref={boardRef}
        className="relative min-h-[32rem] flex-1 overflow-hidden rounded-2xl border bg-[radial-gradient(circle,#e4d3b4_1px,transparent_1px)] bg-[size:22px_22px] bg-card select-none"
      >
        {tokens.length === 0 ? (
          <p className="pointer-events-none absolute top-6 left-6 max-w-xs text-sm text-muted-foreground">
            Drag a creature here, then drop it on another of the same tier. Tier 7 and up click together, then take a third. Turn on Auto-Generate to name that pair with every later creature in one pass.
          </p>
        ) : null}
        {notice ? (
          <p
            role="status"
            className="absolute top-3 left-1/2 z-30 -translate-x-1/2 rounded-full bg-foreground px-3 py-1 text-sm text-background"
          >
            {notice}
          </p>
        ) : null}
        {tokens.map((token) => {
          const creature = catalog.creatures.find((item) => item.id === token.creatureId);
          if (!creature) return null;
          const colors = tierStyle(creature.tier);
          const bond = pairContaining(pairs, token.id);
          const mateId = bond ? (bond.tokenA === token.id ? bond.tokenB : bond.tokenA) : null;
          const mate = mateId ? tokens.find((item) => item.id === mateId) : null;
          const joined = mate ? (token.x <= mate.x ? "left" : "right") : null;
          return (
            <div
              key={token.id}
              data-token-id={token.id}
              className={`absolute w-28 ${joined ? "z-10" : ""}`}
              style={{ left: token.x, top: token.y }}
            >
              <button
                type="button"
                className="absolute -top-2 -right-1 z-10 flex size-6 items-center justify-center rounded-full bg-foreground text-xs text-background"
                aria-label={`Remove ${creature.name}`}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.currentTarget.dataset.press = "1";
                }}
                onClick={(event) => {
                  if (event.currentTarget.dataset.press !== "1") return;
                  event.currentTarget.dataset.press = "";
                  setTokens((current) => current.filter((item) => item.id !== token.id));
                }}
              >
                ×
              </button>
              <div
                className="flex cursor-grab flex-col items-center touch-none select-none active:cursor-grabbing"
                onPointerDown={(event) => startTokenDrag(event, token)}
                onDragStart={(event) => event.preventDefault()}
              >
                <span
                  className={`bg-background p-1 shadow-sm ${
                    joined === "left"
                      ? "rounded-l-2xl rounded-r-md ring-2 ring-primary"
                      : joined === "right"
                        ? "rounded-r-2xl rounded-l-md ring-2 ring-primary"
                        : "rounded-2xl ring-1 ring-foreground/10"
                  }`}
                >
                  <CreatureArt name={creature.name} id={creature.id} className="h-16 w-16" />
                </span>
                <span className="mt-1 max-w-full truncate text-center text-xs font-semibold">
                  {creature.name}
                </span>
                <span
                  className="mt-0.5 rounded-full px-1.5 text-[10px] font-bold"
                  style={{ background: colors.bg, color: colors.fg }}
                >
                  T{creature.tier}
                </span>
              </div>
            </div>
          );
        })}
        {mystery ? (
          <div
            className="absolute z-30 w-52 rounded-2xl border bg-popover p-3 shadow-lg"
            style={{
              left: Math.max(
                8,
                Math.min(mystery.x, (boardRef.current?.clientWidth ?? 280) - 220),
              ),
              top: Math.max(12, mystery.y - 88),
            }}
          >
            <p className="font-heading text-base">New Creature ?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {mysteryParents} don&apos;t have a saved combo.
            </p>
            <div className="mt-2 flex gap-2">
              <Button type="button" size="sm" onClick={openNaming}>
                {autoGenerate && mystery.parentC ? "Name the group" : "Name it"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setMystery(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        ) : null}
        <div
          ref={gapRef}
          className={`absolute top-3 right-3 z-20 flex max-h-52 w-72 max-w-[calc(100%-1.5rem)] min-h-0 flex-col overflow-hidden rounded-2xl border bg-popover/95 text-sm shadow-md backdrop-blur sm:max-h-64 ${gapHot ? "ring-2 ring-primary" : ""}`}
        >
            <div className="shrink-0 px-3 pt-3">
              <p className="text-xs font-semibold tracking-wide uppercase">Missing combos</p>
              <p className="text-xs text-muted-foreground">Drop a creature or a locked pair here.</p>
            </div>
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
              {gapPair?.parentA && gapPair.parentB ? (
                <div aria-live="polite">
                  <p className="font-semibold break-words">
                    {gapPair.parentA.name} + {gapPair.parentB.name}
                  </p>
                  {gapThirds.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Every tier {gapPair.parentA.tier} creature already has a saved combo with these two.
                    </p>
                  ) : (
                    <>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {gapThirds.length} tier {gapPair.parentA.tier}{" "}
                        {gapThirds.length === 1 ? "creature has" : "creatures have"} no saved combo with
                        these two.
                      </p>
                      <ul className="mt-2 space-y-1">
                        {gapThirds.map((partner) => (
                          <li key={partner.id} className="text-xs break-words">
                            {partner.name}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              ) : gapCreature ? (
                <div aria-live="polite">
                  <p className="font-semibold break-words">{gapCreature.name}</p>
                  {gapCreature.tier >= 10 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tier 10 is the top, so nothing in that tier combines further.
                    </p>
                  ) : gapCreature.tier >= 7 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tier {gapCreature.tier} combines three at a time. Lock two together, then drop that
                      pair here to see which third creature is still missing.
                    </p>
                  ) : gaps.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Every tier {gapCreature.tier} creature already has a saved combo with{" "}
                      {gapCreature.name}, including two of them.
                    </p>
                  ) : (
                    <>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {gaps.length} tier {gapCreature.tier}{" "}
                        {gaps.length === 1 ? "partner has" : "partners have"} no saved combo yet.
                      </p>
                      <ul className="mt-2 space-y-1">
                        {gaps.map((partner) => (
                          <li key={partner.id} className="text-xs break-words">
                            {partner.id === gapCreature.id
                              ? `${partner.name} + ${partner.name}`
                              : partner.name}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Every creature in a tier can combine with every creature in that tier, including
                  itself. This lists the ones that are not saved yet.
                </p>
              )}
            </div>
        </div>
        <div
          ref={dockRef}
          className={`absolute right-3 bottom-3 z-20 flex max-h-64 w-72 max-w-[calc(100%-1.5rem)] min-h-0 flex-col overflow-hidden rounded-2xl border bg-popover/95 text-sm shadow-md backdrop-blur ${dockHot ? "ring-2 ring-primary" : ""}`}
        >
            <div className="shrink-0 px-3 pt-3">
              <p className="text-xs font-semibold tracking-wide uppercase">Disassemble</p>
              <p className="text-xs text-muted-foreground">Drop a creature here.</p>
            </div>
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
              {focus && (breakdown || (focus.tier === 7 && dockOwned.length > 0)) ? (
                <div aria-live="polite">
                  <p className="font-semibold break-words">{focus.name}</p>
                  <BreakdownView
                    key={`${focus.id}-${focusVersion}`}
                    creatureId={focus.id}
                    breakdown={breakdown}
                    have={plan?.have ?? stock}
                    owned={plan?.owned ?? owned}
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Set your {starterNames} counts. Use + to add a creature you already own, then drop one here.
                </p>
              )}
            </div>
          </div>
      </div>
      </div>
      {ghost && ghostCreature ? (
        <div
          className="pointer-events-none fixed z-50 w-16 -translate-x-1/2 -translate-y-1/2"
          style={{ left: ghost.x, top: ghost.y }}
        >
          <CreatureArt name={ghostCreature.name} id={ghostCreature.id} className="mx-auto h-16 w-16" />
          <p className="truncate text-center text-xs font-semibold">{ghostCreature.name}</p>
        </div>
      ) : null}
      <Dialog
        open={nameOpen}
        onOpenChange={(open) => {
          if (typeof open !== "boolean") return;
          setNameOpen(open);
          if (!open) setBatchThirds([]);
        }}
      >
        <DialogContent className={batchOpen ? "max-h-[min(40rem,85vh)] overflow-y-auto sm:max-w-lg" : undefined}>
          {batchOpen && mystery?.parentC ? (
            <>
              <DialogHeader>
                <DialogTitle>Name the group</DialogTitle>
                <DialogDescription>
                  {lockedPairLabel} with each creature below makes the same tier{" "}
                  {(catalog.creatures.find((creature) => creature.id === mystery.parentA)?.tier ?? 1) + 1}{" "}
                  creature. One name is saved, and each combo is its own record.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1">
                <Label htmlFor="discovery-group-name">Species name</Label>
                <Input
                  id="discovery-group-name"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  placeholder="River Dragon"
                />
              </div>
              <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
                {batchThirds.map((thirdId) => (
                  <li key={thirdId} className="text-xs break-words">
                    {lockedPairLabel} + {creatureName(catalog, thirdId)}
                  </li>
                ))}
              </ul>
              {nameError ? <p className="text-sm text-destructive">{nameError}</p> : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setNameOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={saveBatch}>
                  Save group
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Name the new creature</DialogTitle>
                <DialogDescription>
                  {mystery
                    ? `${mysteryParents} will be saved as a tier ${
                        (catalog.creatures.find((creature) => creature.id === mystery.parentA)?.tier ?? 1) + 1
                      } result.`
                    : "Save this combo."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1">
                <Label htmlFor="discovery-name">Species name</Label>
                <Input
                  id="discovery-name"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  placeholder="River Dragon"
                />
              </div>
              {nameError ? <p className="text-sm text-destructive">{nameError}</p> : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setNameOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={saveDiscovery}>
                  Save combo
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
