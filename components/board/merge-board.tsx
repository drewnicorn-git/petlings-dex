"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
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
import { pickMergeTarget, type DropBox, type HitBox } from "@/lib/hit";
import {
  adviseStarters,
  attemptMerge,
  creatureName,
  disassemble,
  findByName,
  missingPartners,
  normalizeName,
  type Breakdown,
  type StarterOption,
} from "@/lib/merge";
import { tierStyle } from "@/lib/tiers";
import {
  STARTER_IDS,
  STARTER_NAMES,
  type BoardToken,
  type StarterCounts,
} from "@/lib/types";

const TOKEN_W = 112;
const TOKEN_H = 132;
const STOCK_KEY = "petlings-starter-stock";

function readStock(): StarterCounts {
  const empty = { chick: 0, bunny: 0, cat: 0 };
  if (typeof window === "undefined") return empty;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STOCK_KEY) ?? "") as Partial<StarterCounts>;
    return {
      chick: wholeCount(parsed.chick),
      bunny: wholeCount(parsed.bunny),
      cat: wholeCount(parsed.cat),
    };
  } catch {
    return empty;
  }
}

function wholeCount(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function shortfallText(option: StarterOption): string {
  const parts = STARTER_IDS.filter((id) => option.shortfall[id] > 0).map(
    (id) => `${STARTER_NAMES[id]} × ${option.shortfall[id]}`,
  );
  return parts.join(", ");
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
    };

type Mystery = {
  parentA: string;
  parentB: string;
  tokenA: string;
  tokenB: string;
  x: number;
  y: number;
};

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

function Counts({ counts }: { counts: StarterCounts }) {
  return (
    <ul className="mt-1 space-y-0.5">
      {STARTER_IDS.map((id) => (
        <li key={id}>
          {STARTER_NAMES[id]} × {counts[id]}
        </li>
      ))}
    </ul>
  );
}

function StockField({
  id,
  value,
  onChange,
}: {
  id: (typeof STARTER_IDS)[number];
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

function BreakdownView({
  creatureId,
  breakdown,
  have,
}: {
  creatureId: string;
  breakdown: Breakdown;
  have: StarterCounts;
}) {
  const { catalog } = useCatalog();
  const creature = catalog.creatures.find((item) => item.id === creatureId);
  if (!creature) return null;
  if (breakdown.status === "missing") {
    return (
      <p>
        {creatureName(catalog, breakdown.creatureId)} has no combo yet, so the starter count
        stops there.
      </p>
    );
  }
  if (breakdown.status === "cycle") {
    return <p>This combo loops, so it can&apos;t be counted.</p>;
  }
  if (breakdown.status === "not-starter") {
    return (
      <p>
        {creatureName(catalog, breakdown.creatureId)} is tier 1, but only Chick, Bunny, and Cat
        can start a line.
      </p>
    );
  }
  if (breakdown.status !== "ok") return null;
  const options = adviseStarters(breakdown.paths, breakdown.counts, have);
  const best = options[0];
  const fits = options.filter((option) => option.affordable).length;
  const ways = breakdown.paths.length;
  return (
    <div>
      {best ? (
        <div className="mt-2 rounded-xl bg-muted px-2 py-1.5">
          <p className="text-xs font-semibold">
            {best.affordable ? "Best mix you can make" : "Closest mix"}
          </p>
          {best.path ? (
            <p className="text-xs break-words">
              via {creatureName(catalog, best.path.parentA)} + {creatureName(catalog, best.path.parentB)}
            </p>
          ) : (
            <p className="text-xs">This is a starter.</p>
          )}
          <Counts counts={best.counts} />
          <p className="text-xs text-muted-foreground">
            {best.affordable
              ? "This uses the starters you have the most of."
              : `Still need ${shortfallText(best)}.`}
          </p>
        </div>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">
        {ways === 0
          ? "Starter"
          : `${fits} of ${ways} ${ways === 1 ? "way" : "ways"} fit what you have`}
        {" · "}
        {breakdown.total} starter {breakdown.total === 1 ? "pet" : "pets"}
      </p>
      {ways === 0 ? null : (
        options.map((option) =>
          option.path ? (
            <div
              key={`${option.path.recipeId}-${option.counts.chick}-${option.counts.bunny}-${option.counts.cat}`}
              className={`mt-2 ${option.affordable ? "" : "opacity-60"}`}
            >
              <p className="text-xs break-words">
                via {creatureName(catalog, option.path.parentA)} +{" "}
                {creatureName(catalog, option.path.parentB)}
              </p>
              <p className="text-[10px] font-semibold tracking-wide uppercase">
                {option.affordable ? "Possible" : `Needs ${shortfallText(option)}`}
              </p>
              <Counts counts={option.counts} />
            </div>
          ) : null,
        )
      )}
    </div>
  );
}

export function MergeBoard() {
  const api = useCatalog();
  const { catalog, tokens, setTokens } = api;
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
  const [focusId, setFocusId] = useState<string | null>(null);
  const [gapId, setGapId] = useState<string | null>(null);
  const [stock, setStock] = useState<StarterCounts>({ chick: 0, bunny: 0, cat: 0 });
  const [stockReady, setStockReady] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const noticeTimer = useRef<number | null>(null);

  useEffect(() => {
    setStock(readStock());
    setStockReady(true);
  }, []);

  useEffect(() => {
    if (!stockReady) return;
    window.localStorage.setItem(STOCK_KEY, JSON.stringify(stock));
  }, [stock, stockReady]);

  function setStockCount(id: (typeof STARTER_IDS)[number], value: number) {
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
      const targetId = pickMergeTarget(
        tokenBoxes(),
        drag.kind === "token" ? drag.tokenId : null,
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
        current.map((token) =>
          token.id === drag.tokenId ? { ...token, x: drag.originX, y: drag.originY } : token,
        ),
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
      setTokens((current) =>
        current.map((token) => (token.id === drag.tokenId ? { ...token, ...pos } : token)),
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
          setGapId(drag.creatureId);
          return;
        }
        if (overDock) {
          setFocusId(drag.creatureId);
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
        setGapId(token.creatureId);
        snapBack(drag);
        return;
      }
      if (overDock) {
        setFocusId(token.creatureId);
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
      const attempt = attemptMerge(apiRef.current.catalog, incomingId, target.creatureId);
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
    if (!ids.has(mystery.tokenA) || !ids.has(mystery.tokenB)) setMystery(null);
  }, [mystery, tokens]);

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
    dragRef.current = {
      kind: "token",
      tokenId: token.id,
      creatureId: token.creatureId,
      pointerId: event.pointerId,
      dx: local.x - token.x,
      dy: local.y - token.y,
      originX: token.x,
      originY: token.y,
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
    const saved = api.addRecipe(mystery.parentA, mystery.parentB, resultId);
    if (!saved.ok) {
      setNameError(saved.error);
      return;
    }
    const anchor =
      tokens.find((token) => token.id === mystery.tokenB) ??
      tokens.find((token) => token.id === mystery.tokenA);
    finishMerge(resultId, [mystery.tokenA, mystery.tokenB], anchor?.x ?? 24, anchor?.y ?? 24);
    setNameOpen(false);
    setDraftName("");
    setNameError(null);
  }

  const focus = focusId ? catalog.creatures.find((creature) => creature.id === focusId) : null;
  const breakdown = focusId ? disassemble(focusId, catalog) : null;
  const ghostCreature = ghost
    ? catalog.creatures.find((creature) => creature.id === ghost.creatureId)
    : null;
  const mysteryParents = mystery
    ? [creatureName(catalog, mystery.parentA), creatureName(catalog, mystery.parentB)]
    : [];

  const gapCreature = gapId ? catalog.creatures.find((creature) => creature.id === gapId) : null;
  const gaps = gapCreature ? missingPartners(catalog, gapCreature.id) : [];

  function clearBoard() {
    dragRef.current = null;
    setGhost(null);
    setMystery(null);
    setTokens([]);
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
      <Palette creatures={catalog.creatures} onPointerDown={startPaletteDrag} />
      <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-wrap items-end gap-3">
          <p className="pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            You have
          </p>
          {STARTER_IDS.map((id) => (
            <StockField
              key={id}
              id={id}
              value={stock[id]}
              onChange={(value) => setStockCount(id, value)}
            />
          ))}
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
      <div
        ref={boardRef}
        className="relative min-h-[32rem] flex-1 overflow-hidden rounded-2xl border bg-[radial-gradient(circle,#e4d3b4_1px,transparent_1px)] bg-[size:22px_22px] bg-card select-none"
      >
        {tokens.length === 0 ? (
          <p className="pointer-events-none absolute top-6 left-6 max-w-xs text-sm text-muted-foreground">
            Drag a creature here, then drop it on another of the same tier.
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
          return (
            <div
              key={token.id}
              data-token-id={token.id}
              className="absolute w-28"
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
                <span className="rounded-2xl bg-background p-1 shadow-sm ring-1 ring-foreground/10">
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
              {mysteryParents[0]} and {mysteryParents[1]} don&apos;t have a saved combo.
            </p>
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setDraftName("");
                  setNameError(null);
                  setNameOpen(true);
                }}
              >
                Name it
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
              <p className="text-xs text-muted-foreground">Drop a creature here.</p>
            </div>
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
              {gapCreature ? (
                <div aria-live="polite">
                  <p className="font-semibold break-words">{gapCreature.name}</p>
                  {gapCreature.tier >= 10 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tier 10 is the top, so nothing in that tier combines further.
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
              {focus && breakdown ? (
                <div aria-live="polite">
                  <p className="font-semibold break-words">{focus.name}</p>
                  <BreakdownView creatureId={focus.id} breakdown={breakdown} have={stock} />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Set how many Chicks, Bunnies, and Cats you have, then drop a creature here for the best mix.
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
      <Dialog open={nameOpen} onOpenChange={setNameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Name the new creature</DialogTitle>
            <DialogDescription>
              {mystery
                ? `${mysteryParents[0]} + ${mysteryParents[1]} will be saved as a tier ${
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
