export const STYLES = ["Brawler", "Controller", "Guard", "Healer", "Ranged", "Striker"] as const;

export const TYPES = ["Fire", "Forest", "Ice", "Plains", "River", "Wild"] as const;

export type StyleName = (typeof STYLES)[number];

export type TypeName = (typeof TYPES)[number];

export function isStyle(value: string): value is StyleName {
  return (STYLES as readonly string[]).includes(value);
}

export function isType(value: string): value is TypeName {
  return (TYPES as readonly string[]).includes(value);
}

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
  style?: StyleName;
  type?: TypeName;
  hp?: number;
  atk?: number;
  def?: number;
  spd?: number;
  rng?: number;
};

function readChoice<T extends string>(
  field: unknown,
  options: readonly T[],
): T | undefined | null {
  if (field === undefined || field === null || field === "") return undefined;
  if (typeof field !== "string") return null;
  const text = field.trim().toLowerCase();
  return options.find((option) => option.toLowerCase() === text);
}

export function readAttributes(
  raw: object,
  name = "A creature",
): { ok: true; value: CreatureAttributes } | { ok: false; error: string } {
  const item = raw as Record<string, unknown>;
  const value: CreatureAttributes = {};
  const style = readChoice(item.style, STYLES);
  const type = readChoice(item.type, TYPES);
  if (style === null) return { ok: false, error: `${name} has a style that is not text.` };
  if (type === null) return { ok: false, error: `${name} has a type that is not text.` };
  if (style) value.style = style;
  if (type) value.type = type;
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
  const words = [creature.style, creature.type].filter(
    (item): item is StyleName | TypeName => item !== undefined,
  );
  const stats = STAT_KEYS.filter((key) => creature[key] !== undefined).map(
    (key) => `${STAT_LABELS[key]} ${creature[key]}`,
  );
  const parts = [...words, ...stats];
  return parts.length > 0 ? parts.join(" · ") : null;
}
