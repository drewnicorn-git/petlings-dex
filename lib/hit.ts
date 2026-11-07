export type HitBox = {
  id: string;
  tier: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type DropBox = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

function inflate(box: DropBox, pad: number): DropBox {
  return {
    left: box.left - pad,
    top: box.top - pad,
    right: box.right + pad,
    bottom: box.bottom + pad,
  };
}

function overlaps(a: DropBox, b: DropBox): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function centerDistance(a: DropBox, b: DropBox): number {
  const ax = (a.left + a.right) / 2;
  const ay = (a.top + a.bottom) / 2;
  const bx = (b.left + b.right) / 2;
  const by = (b.top + b.bottom) / 2;
  return Math.hypot(ax - bx, ay - by);
}

export function pickMergeTarget(
  boxes: HitBox[],
  ignoreId: string | null,
  drop: DropBox,
  incomingTier: number,
): string | null {
  const zone = inflate(drop, 28);
  const hits = boxes.filter((box) => box.id !== ignoreId && overlaps(zone, box));
  if (hits.length === 0) return null;
  const sameTier = hits.filter((box) => box.tier === incomingTier);
  const pool = sameTier.length > 0 ? sameTier : hits;
  pool.sort((a, b) => centerDistance(drop, a) - centerDistance(drop, b));
  return pool[0]?.id ?? null;
}
