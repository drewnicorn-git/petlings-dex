import type { ReactNode } from "react";

type Kind =
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
  [/fish|shark/, "fish"],
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

function Frame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 80 72" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

function Eye({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="2.2" fill="#1c140c" />
      <circle cx={cx + 0.7} cy={cy - 0.7} r="0.7" fill="#fff8ea" />
    </g>
  );
}

function picture(kind: Kind): ReactNode {
  switch (kind) {
    case "chick":
      return (
        <>
          <ellipse cx="40" cy="46" rx="18" ry="15" fill="#f6c431" />
          <circle cx="40" cy="28" r="12" fill="#ffd85a" />
          <path d="M50 29 L60 33 L50 36 Z" fill="#ef8a22" />
          <Eye cx={44} cy={26} />
          <path d="M28 50 q6 8 12 0" fill="#f3b425" />
          <path d="M32 60 l4 6 M48 60 l4 6" stroke="#ef8a22" strokeWidth="2" />
        </>
      );
    case "duck":
      return (
        <>
          <ellipse cx="38" cy="46" rx="20" ry="14" fill="#f0c53a" />
          <circle cx="54" cy="34" r="11" fill="#ffd85a" />
          <path d="M62 33 h12 q2 4 -2 6 h-10 Z" fill="#ef8a22" />
          <Eye cx={56} cy={31} />
          <path d="M24 58 q8 6 16 0" fill="#ef8a22" />
        </>
      );
    case "bunny":
      return (
        <>
          <ellipse cx="30" cy="18" rx="6" ry="14" fill="#f4e2c4" />
          <ellipse cx="50" cy="18" rx="6" ry="14" fill="#f4e2c4" />
          <ellipse cx="30" cy="18" rx="3" ry="9" fill="#f3b7c4" />
          <ellipse cx="50" cy="18" rx="3" ry="9" fill="#f3b7c4" />
          <circle cx="40" cy="40" r="16" fill="#f7e7cf" />
          <Eye cx={34} cy={38} />
          <Eye cx={46} cy={38} />
          <path d="M40 42 l-2 3 h4 Z" fill="#e789a4" />
        </>
      );
    case "cat":
      return (
        <>
          <path d="M22 30 L28 14 L36 28 Z" fill="#e8893a" />
          <path d="M58 30 L52 14 L44 28 Z" fill="#e8893a" />
          <circle cx="40" cy="40" r="16" fill="#f2a35a" />
          <ellipse cx="40" cy="46" rx="6" ry="4" fill="#f8d7b0" />
          <Eye cx={34} cy={38} />
          <Eye cx={46} cy={38} />
          <path d="M18 42 h8 M54 42 h8" stroke="#3a2a1c" strokeWidth="1.4" />
          <path d="M58 52 q10 8 4 16" fill="none" stroke="#e8893a" strokeWidth="3" />
        </>
      );
    case "tiger":
      return (
        <>
          <circle cx="40" cy="40" r="18" fill="#f08a2a" />
          <path d="M24 28 l6 4 M30 22 l4 8 M50 22 l-2 8 M56 30 l-6 4" stroke="#2a2118" strokeWidth="2" />
          <ellipse cx="40" cy="48" rx="7" ry="5" fill="#f8e2c4" />
          <Eye cx={33} cy={38} />
          <Eye cx={47} cy={38} />
          <path d="M22 32 L30 16 L36 30 Z M58 32 L50 16 L44 30 Z" fill="#f08a2a" />
        </>
      );
    case "panda":
      return (
        <>
          <circle cx="24" cy="22" r="8" fill="#1c1c1c" />
          <circle cx="56" cy="22" r="8" fill="#1c1c1c" />
          <circle cx="40" cy="40" r="18" fill="#f7f4ee" />
          <ellipse cx="32" cy="40" rx="6" ry="7" fill="#1c1c1c" />
          <ellipse cx="48" cy="40" rx="6" ry="7" fill="#1c1c1c" />
          <circle cx="33" cy="39" r="2" fill="#fff" />
          <circle cx="49" cy="39" r="2" fill="#fff" />
          <ellipse cx="40" cy="50" rx="4" ry="3" fill="#1c1c1c" />
        </>
      );
    case "turtle":
      return (
        <>
          <ellipse cx="42" cy="40" rx="20" ry="16" fill="#3f8f45" />
          <path d="M28 34 h28 M30 42 h24 M32 50 h18" stroke="#1d4a22" strokeWidth="2" />
          <circle cx="18" cy="36" r="7" fill="#67b36a" />
          <Eye cx={16} cy={35} />
          <ellipse cx="30" cy="56" rx="5" ry="3" fill="#67b36a" />
          <ellipse cx="52" cy="56" rx="5" ry="3" fill="#67b36a" />
        </>
      );
    case "dragon":
      return (
        <>
          <path d="M18 46 q16 -28 28 -8 q8 14 20 -6" fill="none" stroke="#2f9a55" strokeWidth="8" strokeLinecap="round" />
          <circle cx="58" cy="28" r="10" fill="#37a85e" />
          <path d="M54 16 l4 8 l6 -6" fill="#1f6b38" />
          <path d="M66 30 h10 l-8 4 Z" fill="#ef8a22" />
          <Eye cx={60} cy={27} />
          <path d="M46 34 q8 10 2 16" fill="#8fd18a" />
        </>
      );
    case "kraken":
      return (
        <>
          <circle cx="40" cy="28" r="14" fill="#7a4db8" />
          <circle cx="40" cy="28" r="6" fill="#f4e7ff" />
          <circle cx="41" cy="28" r="2.4" fill="#241433" />
          <path d="M22 42 q6 16 -4 18 M32 44 q4 18 2 20 M40 46 q0 16 6 16 M50 44 q2 16 8 14 M60 42 q4 12 10 8" fill="none" stroke="#6a3ea6" strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case "lion":
      return (
        <>
          <circle cx="40" cy="38" r="20" fill="#e2a23a" />
          <circle cx="40" cy="40" r="12" fill="#f0c27a" />
          <Eye cx={35} cy={38} />
          <Eye cx={45} cy={38} />
          <path d="M40 42 l-2 3 h4 Z" fill="#c47a4a" />
        </>
      );
    case "phoenix":
      return (
        <>
          <path d="M40 44 q-20 -4 -24 -20 q16 4 24 12 q8 -10 24 -14 q-6 16 -24 22 Z" fill="#ef5a32" />
          <path d="M40 40 q18 -8 22 -2 q-12 2 -22 8 Z" fill="#f6c14e" />
          <circle cx="46" cy="28" r="7" fill="#ff7a3c" />
          <path d="M44 16 l3 7 l5 -4" fill="#f6c14e" />
          <Eye cx={48} cy={27} />
          <path d="M36 50 q6 12 2 14" stroke="#ef5a32" strokeWidth="3" fill="none" />
        </>
      );
    case "wolf":
      return (
        <>
          <path d="M24 34 L30 16 L38 32 Z M56 34 L50 16 L42 32 Z" fill="#8d97a3" />
          <circle cx="40" cy="42" r="15" fill="#aeb6c2" />
          <ellipse cx="40" cy="48" rx="6" ry="4" fill="#eceff3" />
          <Eye cx={34} cy={40} />
          <Eye cx={46} cy={40} />
        </>
      );
    case "fox":
      return (
        <>
          <path d="M22 36 L30 14 L38 32 Z M58 36 L50 14 L42 32 Z" fill="#e07a2f" />
          <circle cx="40" cy="42" r="15" fill="#f0903a" />
          <ellipse cx="40" cy="48" rx="6" ry="5" fill="#fff3e4" />
          <Eye cx={34} cy={40} />
          <Eye cx={46} cy={40} />
          <path d="M62 50 q10 4 6 14 q-8 -2 -6 -14 Z" fill="#e07a2f" />
        </>
      );
    case "frog":
      return (
        <>
          <circle cx="28" cy="24" r="8" fill="#63b84a" />
          <circle cx="52" cy="24" r="8" fill="#63b84a" />
          <circle cx="28" cy="24" r="3" fill="#1c140c" />
          <circle cx="52" cy="24" r="3" fill="#1c140c" />
          <ellipse cx="40" cy="46" rx="18" ry="13" fill="#74c85a" />
          <path d="M30 48 q10 8 20 0" fill="none" stroke="#1f4a18" strokeWidth="2" />
        </>
      );
    case "bear":
      return (
        <>
          <circle cx="24" cy="24" r="8" fill="#8a5a32" />
          <circle cx="56" cy="24" r="8" fill="#8a5a32" />
          <circle cx="40" cy="42" r="18" fill="#a56b3c" />
          <ellipse cx="40" cy="48" rx="7" ry="5" fill="#e6c39a" />
          <Eye cx={33} cy={40} />
          <Eye cx={47} cy={40} />
        </>
      );
    case "owl":
      return (
        <>
          <ellipse cx="40" cy="40" rx="16" ry="18" fill="#c4844a" />
          <circle cx="33" cy="36" r="6" fill="#f6efe2" />
          <circle cx="47" cy="36" r="6" fill="#f6efe2" />
          <circle cx="33" cy="36" r="2.4" fill="#1c140c" />
          <circle cx="47" cy="36" r="2.4" fill="#1c140c" />
          <path d="M40 40 l-3 4 h6 Z" fill="#ef8a22" />
        </>
      );
    case "fish":
      return (
        <>
          <ellipse cx="36" cy="36" rx="18" ry="12" fill="#4aa0d8" />
          <path d="M52 36 l14 -10 v20 Z" fill="#3b86c4" />
          <Eye cx={26} cy={34} />
          <path d="M34 26 q6 4 0 8" fill="#7ec4ea" />
        </>
      );
    case "snake":
      return (
        <>
          <path d="M16 48 q14 -20 20 -4 q8 16 16 0 q8 -16 16 2" fill="none" stroke="#3f9a4a" strokeWidth="7" strokeLinecap="round" />
          <circle cx="62" cy="42" r="6" fill="#3f9a4a" />
          <Eye cx={64} cy={41} />
        </>
      );
    case "horse":
      return (
        <>
          <ellipse cx="36" cy="44" rx="16" ry="12" fill="#a56b3c" />
          <circle cx="54" cy="32" r="10" fill="#c4844a" />
          <path d="M48 22 q6 6 2 12" fill="#6b3d22" />
          <path d="M62 30 h8" stroke="#6b3d22" strokeWidth="2" />
          <Eye cx={56} cy={31} />
          <path d="M24 54 l-2 10 M40 56 l2 10" stroke="#8a5a32" strokeWidth="3" />
        </>
      );
    case "mammoth":
      return (
        <>
          <circle cx="40" cy="36" r="16" fill="#8d97a3" />
          <ellipse cx="22" cy="38" rx="8" ry="10" fill="#aeb6c2" />
          <ellipse cx="58" cy="38" rx="8" ry="10" fill="#aeb6c2" />
          <path d="M32 48 q-2 14 6 14 M48 48 q2 14 -6 14" fill="none" stroke="#f4efe4" strokeWidth="3" />
          <Eye cx={36} cy={34} />
          <Eye cx={48} cy={34} />
        </>
      );
    default:
      return (
        <>
          <ellipse cx="30" cy="22" rx="6" ry="8" fill="#e7d3b0" />
          <ellipse cx="50" cy="22" rx="6" ry="8" fill="#e7d3b0" />
          <circle cx="40" cy="42" r="16" fill="#f0ddc0" />
          <Eye cx={34} cy={40} />
          <Eye cx={46} cy={40} />
          <path d="M36 48 q4 4 8 0" fill="none" stroke="#a87858" strokeWidth="1.6" />
        </>
      );
  }
}

export function CreatureArt({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return <Frame className={className}>{picture(artKind(name))}</Frame>;
}
