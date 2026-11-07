export const STAT_KEYS = ["hp", "atk", "def", "spd", "rng"] as const;

export type StatKey = (typeof STAT_KEYS)[number];

export const STAT_LABELS: Record<StatKey, string> = {
  hp: "HP",
  atk: "ATK",
  def: "DEF",
  spd: "SPD",
  rng: "RNG",
};

export type CreatureAttributes = {
  style?: string;
  type?: string;
  hp?: number;
  atk?: number;
  def?: number;
  spd?: number;
  rng?: number;
};

const TEXT_LIMIT = 40;

export function readAttributes(
  raw: object,
  name = "A creature",
): { ok: true; value: CreatureAttributes } | { ok: false; error: string } {
  const item = raw as Record<string, unknown>;
  const value: CreatureAttributes = {};
  for (const key of ["style", "type"] as const) {
    const field = item[key];
    if (field === undefined || field === null) continue;
    if (typeof field !== "string") {
      return { ok: false, error: `${name} has a ${key} that is not text.` };
    }
    const text = field.trim().replace(/\s+/g, " ");
    if (!text) continue;
    if (text.length > TEXT_LIMIT) {
      return { ok: false, error: `${name} has a ${key} longer than ${TEXT_LIMIT} characters.` };
    }
    value[key] = text;
  }
  for (const key of STAT_KEYS) {
    const field = item[key];
    if (field === undefined || field === null || field === "") continue;
    if (typeof field !== "number" || !Number.isInteger(field)) {
      return { ok: false, error: `${name} needs ${STAT_LABELS[key]} to be a whole number.` };
    }
    value[key] = field;
  }
  return { ok: true, value };
}

export function attributeSummary(creature: CreatureAttributes): string | null {
  const words = [creature.style, creature.type].filter((item): item is string => Boolean(item));
  const stats = STAT_KEYS.filter((key) => creature[key] !== undefined).map(
    (key) => `${STAT_LABELS[key]} ${creature[key]}`,
  );
  const parts = [...words, ...stats];
  return parts.length > 0 ? parts.join(" · ") : null;
}
