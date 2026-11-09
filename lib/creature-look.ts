export type Kind =
  | "phoenix"
  | "kraken"
  | "dragon"
  | "turtle"
  | "panda"
  | "tiger"
  | "lion"
  | "mammoth"
  | "horse"
  | "snake"
  | "fish"
  | "owl"
  | "bear"
  | "frog"
  | "fox"
  | "wolf"
  | "duck"
  | "chick"
  | "bunny"
  | "cat"
  | "generic";

export type Pattern = "plain" | "stripes" | "spots" | "patch" | "mask" | "speckle";

export type Extra =
  | "none"
  | "horns"
  | "crown"
  | "wings"
  | "bow"
  | "flame"
  | "flower"
  | "star"
  | "scarf"
  | "tusks"
  | "fin"
  | "mane";

export type CreatureLook = {
  name: string;
  kind: Kind;
  variant: number;
  body: string;
  belly: string;
  accent: string;
  dark: string;
  pattern: Pattern;
  extra: Extra;
  seed: number;
  classic: boolean;
};

type Palette = { body: string; belly: string; accent: string; dark: string };

const PALETTES: Palette[] = [
  { body: "#e0a106", belly: "#fff3c4", accent: "#c2410c", dark: "#6b3a04" },
  { body: "#1f7aa8", belly: "#d7f3ff", accent: "#f0b429", dark: "#0c3348" },
  { body: "#5b35c9", belly: "#efe8ff", accent: "#f6c14e", dark: "#24145a" },
  { body: "#e85d04", belly: "#ffe0c2", accent: "#ffba08", dark: "#6b2408" },
  { body: "#3d8eb0", belly: "#f3fbff", accent: "#14324a", dark: "#16384d" },
  { body: "#d94680", belly: "#ffe4f0", accent: "#f6c14e", dark: "#6b1238" },
  { body: "#3f8f45", belly: "#e5f6df", accent: "#f0b429", dark: "#143218" },
  { body: "#d97706", belly: "#ffedd5", accent: "#7c2d12", dark: "#4a220c" },
  { body: "#8a6242", belly: "#f7efe4", accent: "#f0b429", dark: "#2c2118" },
  { body: "#5c6b7a", belly: "#f4f7fb", accent: "#f0b429", dark: "#1c2430" },
  { body: "#d23b45", belly: "#ffe4e6", accent: "#f6c14e", dark: "#4c0519" },
  { body: "#0f766e", belly: "#d9fffb", accent: "#f0b429", dark: "#042f2e" },
  { body: "#d4a017", belly: "#fff1c2", accent: "#9a3412", dark: "#3f2a04" },
  { body: "#e11d48", belly: "#ffe4e6", accent: "#f6c14e", dark: "#4c0519" },
  { body: "#4d7c0f", belly: "#ecfccb", accent: "#f0b429", dark: "#1a2e05" },
  { body: "#7e22ce", belly: "#f3e8ff", accent: "#f6c14e", dark: "#3b0764" },
];

const THEMES: Array<[RegExp, Palette]> = [
  [/frost|ice|snow|glacier|winter|arctic/, PALETTES[4]],
  [/river|water|sea|ocean|aqua|tide|lake/, PALETTES[1]],
  [/inferno|fire|flame|lava|ember|volcan/, PALETTES[3]],
  [/cosmic|star|galaxy|void|night|moon/, PALETTES[2]],
  [/forest|leaf|moss|tree|wood|bamboo/, PALETTES[6]],
  [/royal|sovereign|king|queen|emperor/, PALETTES[15]],
];

const PATTERNS: Pattern[] = ["plain", "stripes", "spots", "patch", "mask", "speckle"];
const EXTRAS: Extra[] = [
  "horns",
  "crown",
  "wings",
  "bow",
  "flame",
  "flower",
  "star",
  "scarf",
  "tusks",
  "fin",
  "mane",
  "none",
];

const CLASSIC = new Set(["chick", "bunny", "cat", "duck", "tiger", "panda", "kraken"]);

const RULES: Array<[RegExp, Kind]> = [
  [/phoenix/, "phoenix"],
  [/kraken|octopus|squid/, "kraken"],
  [/dragon/, "dragon"],
  [/turtle|tortoise/, "turtle"],
  [/panda/, "panda"],
  [/tiger/, "tiger"],
  [/lion/, "lion"],
  [/mammoth|elephant/, "mammoth"],
  [/horse|pony/, "horse"],
  [/snake|serpent/, "snake"],
  [/fish|shark|clownfish|seahorse|whale|dolphin|orca|seal|narwhal|lobster|crab|shrimp|jellyfish|starfish|eel|squid|manta|turtle/, "fish"],
  [/owl/, "owl"],
  [/bear/, "bear"],
  [/frog|toad/, "frog"],
  [/fox/, "fox"],
  [/wolf|husky|dog|pup/, "wolf"],
  [/duck|goose|swan/, "duck"],
  [/chick|chicken|hen|rooster/, "chick"],
  [/bunny|rabbit|hare/, "bunny"],
  [/cat|kitten|lynx/, "cat"],
];

export function artKind(name: string): Kind {
  const text = name.toLowerCase();
  for (const [pattern, kind] of RULES) {
    if (pattern.test(text)) return kind;
  }
  return "generic";
}

export function hashName(name: string): number {
  let hash = 2166136261;
  const text = name.trim().toLowerCase();
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function extraFor(name: string, fallback: Extra, kind: Kind): Extra {
  let extra = fallback;
  if (/sovereign|king|queen|royal|emperor|prince|crown/.test(name)) extra = "crown";
  else if (/inferno|fire|flame|ember|lava/.test(name)) extra = "flame";
  else if (/cosmic|star|galaxy/.test(name)) extra = "star";
  else if (/river|sea|ocean|tide/.test(name)) extra = "fin";
  else if (/frost|ice|snow/.test(name)) extra = "scarf";
  if (kind === "phoenix" && extra === "wings") extra = "flame";
  if (kind === "dragon" && extra === "fin") extra = "wings";
  return extra;
}

export function lookFor(name: string): CreatureLook {
  const cleaned = name.trim().replace(/\s+/g, " ");
  const key = cleaned.toLowerCase();
  const seed = hashName(cleaned);
  const kind = artKind(key);
  if (CLASSIC.has(key)) {
    return {
      name: cleaned,
      kind,
      variant: 0,
      body: "",
      belly: "",
      accent: "",
      dark: "",
      pattern: "plain",
      extra: "none",
      seed,
      classic: true,
    };
  }
  const themed = THEMES.find(([pattern]) => pattern.test(key))?.[1];
  const palette = themed ?? PALETTES[seed % PALETTES.length];
  return {
    name: cleaned,
    kind,
    variant: seed % 6,
    body: palette.body,
    belly: palette.belly,
    accent: palette.accent,
    dark: palette.dark,
    pattern: PATTERNS[(seed >>> 4) % PATTERNS.length],
    extra: extraFor(key, EXTRAS[(seed >>> 8) % EXTRAS.length], kind),
    seed,
    classic: false,
  };
}

export function artSignature(name: string): string {
  const look = lookFor(name);
  if (look.classic) return `classic:${look.name.toLowerCase()}`;
  return [
    look.kind,
    look.variant,
    look.body,
    look.belly,
    look.accent,
    look.dark,
    look.pattern,
    look.extra,
    look.seed,
  ].join("|");
}
