"use client";

import { useCatalog } from "@/components/catalog-context";
import { COLLECTION_TOTAL, TIERS, TIER_TOTALS } from "@/lib/tiers";

export function TierProgress() {
  const { ready, catalog } = useCatalog();
  if (!ready) return null;

  const unlockedByTier = new Map<number, number>();
  for (const creature of catalog.creatures) {
    unlockedByTier.set(creature.tier, (unlockedByTier.get(creature.tier) ?? 0) + 1);
  }
  const unlocked = catalog.creatures.length;

  return (
    <section className="mt-4" aria-label="Unlocked creatures by tier">
      <p className="text-sm font-semibold">
        {unlocked} / {COLLECTION_TOTAL} unlocked
      </p>
      <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {TIERS.map((tier) => {
          const have = unlockedByTier.get(tier.tier) ?? 0;
          const total = TIER_TOTALS[tier.tier] ?? 0;
          const width = total === 0 ? 0 : Math.min(100, Math.round((have / total) * 100));
          return (
            <li
              key={tier.tier}
              className="min-w-[4.5rem] shrink-0 rounded-xl px-2 py-1.5"
              style={{ background: tier.bg, color: tier.fg }}
            >
              <p className="text-[10px] font-bold tracking-wide uppercase">Tier {tier.tier}</p>
              <p className="font-heading text-lg leading-tight">
                {have}
                <span className="text-xs font-semibold">/{total}</span>
              </p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/20" aria-hidden="true">
                <div className="h-full bg-current" style={{ width: `${width}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
