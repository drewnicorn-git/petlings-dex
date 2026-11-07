import { describe, expect, it } from "vitest";
import { pickMergeTarget, type HitBox } from "@/lib/hit";

const duck: HitBox = { id: "duck", tier: 2, left: 0, top: 0, right: 112, bottom: 140 };
const tiger: HitBox = { id: "tiger", tier: 2, left: 90, top: 20, right: 202, bottom: 160 };
const frog: HitBox = { id: "frog", tier: 3, left: 80, top: 10, right: 192, bottom: 150 };
const far: HitBox = { id: "far", tier: 2, left: 500, top: 500, right: 612, bottom: 640 };

describe("pickMergeTarget", () => {
  it("picks the same-tier creature the drop overlaps", () => {
    expect(
      pickMergeTarget([duck, tiger, far], "duck", duck, 2),
    ).toBe("tiger");
  });

  it("prefers a same-tier overlap over a closer different tier", () => {
    expect(pickMergeTarget([frog, tiger], null, duck, 2)).toBe("tiger");
  });

  it("returns the different-tier creature when that is the only overlap", () => {
    expect(pickMergeTarget([frog, far], null, duck, 2)).toBe("frog");
  });

  it("returns nothing when the drop misses every creature", () => {
    expect(pickMergeTarget([far], null, duck, 2)).toBeNull();
  });
});
