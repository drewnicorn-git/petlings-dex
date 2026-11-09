"use client";

import { useEffect, useState, type ReactNode } from "react";
import { assetPath } from "@/lib/asset-path";
import {
  lookFor,
  type CreatureLook,
  type Extra,
} from "@/lib/creature-look";
import { PREPARED_PORTRAITS } from "@/lib/portraits";
import { slugify } from "@/lib/merge";
import { seaCatalog, seedCatalog } from "@/lib/seed";

const PORTRAIT_IDS = new Set([
  ...seedCatalog.creatures.map((creature) => creature.id),
  ...seaCatalog.creatures.map((creature) => creature.id),
  ...PREPARED_PORTRAITS,
]);

function portraitIdFor(id: string | undefined, name: string): string | null {
  if (id && PORTRAIT_IDS.has(id)) return id;
  const slug = slugify(name);
  return PORTRAIT_IDS.has(slug) ? slug : null;
}

function Frame({ children, className }: { children: ReactNode; className?: string }) {
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

function Marks({ look, cx, cy }: { look: CreatureLook; cx: number; cy: number }) {
  const shift = look.seed % 5;
  if (look.pattern === "stripes") {
    return (
      <g stroke={look.dark} strokeWidth="2" strokeLinecap="round">
        <path d={`M${cx - 12 + shift} ${cy - 2} l7 3`} />
        <path d={`M${cx - 2} ${cy - 8} l6 6`} />
        <path d={`M${cx + 4} ${cy - 4} l5 4`} />
      </g>
    );
  }
  if (look.pattern === "spots" || look.pattern === "speckle") {
    const radius = look.pattern === "speckle" ? 1.3 : 2.2;
    return (
      <g fill={look.dark}>
        <circle cx={cx - 8 + shift} cy={cy - 2} r={radius} />
        <circle cx={cx + 2} cy={cy + 4} r={radius} />
        <circle cx={cx + 7} cy={cy - 5} r={radius} />
        {look.pattern === "speckle" ? <circle cx={cx - 2} cy={cy + 7} r={radius} /> : null}
      </g>
    );
  }
  if (look.pattern === "patch") {
    return <ellipse cx={cx + shift} cy={cy + 6} rx="7" ry="4" fill={look.belly} />;
  }
  if (look.pattern === "mask") {
    return <ellipse cx={cx} cy={cy - 1} rx="11" ry="5" fill={look.dark} opacity="0.35" />;
  }
  return null;
}

function Flourish({ look, x, y, behind }: { look: CreatureLook; x: number; y: number; behind?: boolean }) {
  const { extra, accent, dark, belly } = look;
  const back = new Set<Extra>(["wings", "mane"]);
  if (behind !== back.has(extra)) return null;
  if (extra === "horns") {
    return (
      <path
        d={`M${x - 10} ${y + 6} l4 -12 l5 8 M${x + 4} ${y + 4} l3 -11 l5 8`}
        fill={dark}
      />
    );
  }
  if (extra === "crown") {
    return <path d={`M${x - 9} ${y + 4} l3 -9 l4 6 l4 -8 l4 7 l3 -6 v10 z`} fill={accent} />;
  }
  if (extra === "wings") {
    return (
      <g fill={accent}>
        <ellipse cx={x - 16} cy={y + 14} rx="14" ry="7" transform={`rotate(-28 ${x - 16} ${y + 14})`} />
        <ellipse cx={x + 16} cy={y + 14} rx="14" ry="7" transform={`rotate(28 ${x + 16} ${y + 14})`} />
      </g>
    );
  }
  if (extra === "bow") {
    return (
      <g>
        <circle cx={x - 5} cy={y} r="3.4" fill={accent} />
        <circle cx={x + 5} cy={y} r="3.4" fill={accent} />
        <circle cx={x} cy={y} r="1.5" fill={dark} />
      </g>
    );
  }
  if (extra === "flame") {
    return <path d={`M${x} ${y - 12} q7 7 2 14 q-3 -5 -2 -14`} fill={accent} />;
  }
  if (extra === "flower") {
    return (
      <g>
        <circle cx={x} cy={y - 3} r="2.1" fill={accent} />
        <circle cx={x - 3} cy={y} r="2.1" fill={accent} />
        <circle cx={x + 3} cy={y} r="2.1" fill={accent} />
        <circle cx={x} cy={y + 3} r="2.1" fill={accent} />
        <circle cx={x} cy={y} r="1.4" fill={belly} />
      </g>
    );
  }
  if (extra === "star") {
    return (
      <path
        d={`M${x} ${y - 8} l1.8 4.2 h4.4 l-3.5 2.6 1.4 4.2 L${x} ${y + 0.4} l-4.1 2.6 1.4 -4.2 -3.5 -2.6 h4.4 z`}
        fill={accent}
      />
    );
  }
  if (extra === "scarf") {
    return <path d={`M${x - 12} ${y + 8} h22 q3 7 -5 9 h-10 q-8 -2 -7 -9 z`} fill={accent} />;
  }
  if (extra === "tusks") {
    return (
      <path
        d={`M${x - 5} ${y + 8} q-2 8 3 9 M${x + 5} ${y + 8} q2 8 -3 9`}
        fill="none"
        stroke={belly}
        strokeWidth="2"
        strokeLinecap="round"
      />
    );
  }
  if (extra === "fin") {
    return <path d={`M${x} ${y} q12 -10 16 1 q-10 2 -16 -1`} fill={accent} />;
  }
  if (extra === "mane") {
    return <circle cx={x} cy={y + 6} r="16" fill={accent} />;
  }
  return null;
}

function classicPicture(name: string): ReactNode {
  switch (name.toLowerCase()) {
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
    default:
      return (
        <>
          <circle cx="40" cy="28" r="14" fill="#7a4db8" />
          <circle cx="40" cy="28" r="6" fill="#f4e7ff" />
          <circle cx="41" cy="28" r="2.4" fill="#241433" />
          <path
            d="M22 42 q6 16 -4 18 M32 44 q4 18 2 20 M40 46 q0 16 6 16 M50 44 q2 16 8 14 M60 42 q4 12 10 8"
            fill="none"
            stroke="#6a3ea6"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      );
  }
}

function portrait(look: CreatureLook): ReactNode {
  const { body, belly, accent, dark } = look;
  const ear = 12 + (look.seed % 6);
  const anchor = { x: 40, y: 14 };
  const spot = { x: 40, y: 46 };
  let face = (
    <>
      <circle cx="40" cy="40" r="16" fill={body} />
      <Eye cx={34} cy={38} />
      <Eye cx={46} cy={38} />
    </>
  );

  switch (look.kind) {
    case "chick":
      anchor.y = 14;
      face = (
        <>
          <ellipse cx="40" cy="46" rx="18" ry="15" fill={body} />
          <circle cx="40" cy="28" r="12" fill={belly} />
          <path d="M50 29 L60 33 L50 36 Z" fill={accent} />
          <Eye cx={44} cy={26} />
          <path d="M32 60 l4 6 M48 60 l4 6" stroke={accent} strokeWidth="2" />
        </>
      );
      break;
    case "duck":
      anchor.x = 54;
      anchor.y = 18;
      face = (
        <>
          <ellipse cx="38" cy="46" rx="20" ry="14" fill={body} />
          <circle cx="54" cy="34" r="11" fill={belly} />
          <path d="M62 33 h12 q2 4 -2 6 h-10 Z" fill={accent} />
          <Eye cx={56} cy={31} />
        </>
      );
      break;
    case "bunny":
      face = (
        <>
          <ellipse cx="28" cy={20} rx="6" ry={ear} fill={body} />
          <ellipse cx="52" cy={20} rx="6" ry={ear} fill={body} />
          <ellipse cx="28" cy={20} rx="3" ry={ear - 5} fill={accent} />
          <ellipse cx="52" cy={20} rx="3" ry={ear - 5} fill={accent} />
          <circle cx="40" cy="42" r="16" fill={belly} />
          <Eye cx={34} cy={40} />
          <Eye cx={46} cy={40} />
          <path d="M40 44 l-2 3 h4 Z" fill={accent} />
        </>
      );
      break;
    case "cat":
      face = (
        <>
          <path d="M22 30 L28 14 L36 28 Z" fill={body} />
          <path d="M58 30 L52 14 L44 28 Z" fill={body} />
          <circle cx="40" cy="40" r="16" fill={belly} />
          <ellipse cx="40" cy="46" rx="6" ry="4" fill={accent} />
          <Eye cx={34} cy={38} />
          <Eye cx={46} cy={38} />
          <path d="M58 52 q10 8 4 16" fill="none" stroke={body} strokeWidth="3" />
        </>
      );
      break;
    case "tiger":
      face = (
        <>
          <path d="M22 32 L30 16 L36 30 Z M58 32 L50 16 L44 30 Z" fill={body} />
          <circle cx="40" cy="40" r="18" fill={body} />
          <ellipse cx="40" cy="48" rx="7" ry="5" fill={belly} />
          <Eye cx={33} cy={38} />
          <Eye cx={47} cy={38} />
        </>
      );
      break;
    case "panda":
      face = (
        <>
          <circle cx="24" cy="22" r="8" fill={dark} />
          <circle cx="56" cy="22" r="8" fill={dark} />
          <circle cx="40" cy="40" r="18" fill={belly} />
          <ellipse cx="32" cy="40" rx="6" ry="7" fill={dark} />
          <ellipse cx="48" cy="40" rx="6" ry="7" fill={dark} />
          <circle cx="33" cy="39" r="2" fill="#fff" />
          <circle cx="49" cy="39" r="2" fill="#fff" />
          <ellipse cx="40" cy="50" rx="4" ry="3" fill={accent} />
        </>
      );
      break;
    case "turtle":
      anchor.x = 16;
      anchor.y = 18;
      spot.x = 46;
      spot.y = 40;
      face = (
        <>
          <ellipse cx="46" cy="40" rx="18" ry="14" fill={body} />
          <path
            d="M46 28 v24 M34 40 h24 M38 33 q8 5 16 0 M38 47 q8 -5 16 0"
            fill="none"
            stroke={belly}
            strokeWidth="1.6"
          />
          <circle cx="20" cy="38" r="9" fill={belly} />
          <path d="M26 40 h8 l-6 3 Z" fill={accent} />
          <Eye cx={16} cy={36} />
          <ellipse cx="34" cy="56" rx="6" ry="3" fill={accent} />
          <ellipse cx="56" cy="56" rx="6" ry="3" fill={accent} />
        </>
      );
      break;
    case "dragon":
      anchor.x = 58;
      anchor.y = 8;
      spot.x = 34;
      spot.y = 46;
      face = (
        <>
          <path
            d="M12 52 q16 -28 26 -8 q10 16 22 -8"
            fill="none"
            stroke={body}
            strokeWidth="12"
            strokeLinecap="round"
          />
          <circle cx="56" cy="30" r="13" fill={body} />
          <circle cx="58" cy="32" r="7" fill={belly} />
          <path d="M66 32 h12 l-9 5 Z" fill={accent} />
          <Eye cx={60} cy={30} />
        </>
      );
      break;
    case "kraken":
      face = (
        <>
          <circle cx="40" cy="28" r="14" fill={body} />
          <circle cx="40" cy="28" r="6" fill={belly} />
          <circle cx="41" cy="28" r="2.4" fill={dark} />
          <path
            d="M22 42 q6 16 -4 18 M32 44 q4 18 2 20 M40 46 q0 16 6 16 M50 44 q2 16 8 14 M60 42 q4 12 10 8"
            fill="none"
            stroke={accent}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      );
      break;
    case "lion":
      face = (
        <>
          <circle cx="40" cy="38" r="20" fill={accent} />
          <circle cx="40" cy="40" r="12" fill={body} />
          <Eye cx={35} cy={38} />
          <Eye cx={45} cy={38} />
          <path d="M40 42 l-2 3 h4 Z" fill={dark} />
        </>
      );
      break;
    case "phoenix":
      anchor.x = 46;
      anchor.y = 10;
      face = (
        <>
          <path d="M40 44 q-20 -4 -24 -20 q16 4 24 12 q8 -10 24 -14 q-6 16 -24 22 Z" fill={body} />
          <path d="M40 40 q18 -8 22 -2 q-12 2 -22 8 Z" fill={accent} />
          <circle cx="46" cy="28" r="7" fill={belly} />
          <Eye cx={48} cy={27} />
          <path d="M36 50 q6 12 2 14" stroke={accent} strokeWidth="3" fill="none" />
        </>
      );
      break;
    case "wolf":
    case "fox":
      face = (
        <>
          <path d="M22 36 L30 12 L38 32 Z M58 36 L50 12 L42 32 Z" fill={body} />
          <circle cx="40" cy="42" r="15" fill={belly} />
          <ellipse cx="40" cy="48" rx="6" ry="4" fill={accent} />
          <Eye cx={34} cy={40} />
          <Eye cx={46} cy={40} />
          {look.kind === "fox" ? (
            <path d="M62 50 q10 4 6 14 q-8 -2 -6 -14 Z" fill={body} />
          ) : null}
        </>
      );
      break;
    case "frog":
      face = (
        <>
          <circle cx="28" cy="24" r="8" fill={body} />
          <circle cx="52" cy="24" r="8" fill={body} />
          <circle cx="28" cy="24" r="3" fill={dark} />
          <circle cx="52" cy="24" r="3" fill={dark} />
          <ellipse cx="40" cy="46" rx="18" ry="13" fill={belly} />
          <path d="M30 48 q10 8 20 0" fill="none" stroke={dark} strokeWidth="2" />
        </>
      );
      break;
    case "bear":
      face = (
        <>
          <circle cx="24" cy="24" r="8" fill={dark} />
          <circle cx="56" cy="24" r="8" fill={dark} />
          <circle cx="40" cy="42" r="18" fill={body} />
          <ellipse cx="40" cy="48" rx="7" ry="5" fill={belly} />
          <Eye cx={33} cy={40} />
          <Eye cx={47} cy={40} />
        </>
      );
      break;
    case "owl":
      face = (
        <>
          <ellipse cx="40" cy="40" rx="16" ry="18" fill={body} />
          <circle cx="33" cy="36" r="6" fill={belly} />
          <circle cx="47" cy="36" r="6" fill={belly} />
          <circle cx="33" cy="36" r="2.4" fill={dark} />
          <circle cx="47" cy="36" r="2.4" fill={dark} />
          <path d="M40 40 l-3 4 h6 Z" fill={accent} />
        </>
      );
      break;
    case "fish":
      anchor.y = 18;
      face = (
        <>
          <ellipse cx="36" cy="36" rx="18" ry="12" fill={body} />
          <path d="M52 36 l14 -10 v20 Z" fill={accent} />
          <Eye cx={26} cy={34} />
          <path d="M34 26 q6 4 0 8" fill={belly} />
        </>
      );
      break;
    case "snake":
      anchor.x = 62;
      anchor.y = 30;
      face = (
        <>
          <path
            d="M16 48 q14 -20 20 -4 q8 16 16 0 q8 -16 16 2"
            fill="none"
            stroke={body}
            strokeWidth="7"
            strokeLinecap="round"
          />
          <circle cx="62" cy="42" r="6" fill={belly} />
          <Eye cx={64} cy={41} />
        </>
      );
      break;
    case "horse":
      anchor.x = 54;
      anchor.y = 16;
      face = (
        <>
          <ellipse cx="36" cy="44" rx="16" ry="12" fill={body} />
          <circle cx="54" cy="32" r="10" fill={belly} />
          <path d="M48 20 q8 8 2 14" fill={dark} />
          <Eye cx={56} cy={31} />
          <path d="M24 54 l-2 10 M40 56 l2 10" stroke={accent} strokeWidth="3" />
        </>
      );
      break;
    case "mammoth":
      face = (
        <>
          <ellipse cx="22" cy="38" rx="8" ry="10" fill={accent} />
          <ellipse cx="58" cy="38" rx="8" ry="10" fill={accent} />
          <circle cx="40" cy="36" r="16" fill={body} />
          <path d="M32 48 q-2 12 6 12 M48 48 q2 12 -6 12" fill="none" stroke={belly} strokeWidth="3" />
          <Eye cx={36} cy={34} />
          <Eye cx={48} cy={34} />
        </>
      );
      break;
    default: {
      const variant = look.variant;
      if (variant === 0) {
        face = (
          <>
            <path d="M24 34 L30 14 L38 30 Z M56 34 L50 14 L42 30 Z" fill={body} />
            <circle cx="40" cy="42" r="16" fill={belly} />
            <ellipse cx="40" cy="48" rx="5" ry="3" fill={accent} />
            <Eye cx={34} cy={40} />
            <Eye cx={46} cy={40} />
          </>
        );
      } else if (variant === 1) {
        anchor.x = 50;
        face = (
          <>
            <ellipse cx="36" cy="42" rx="16" ry="14" fill={body} />
            <circle cx="52" cy="32" r="9" fill={belly} />
            <path d="M58 32 h10 l-8 4 Z" fill={accent} />
            <Eye cx={54} cy={30} />
            <path d="M28 56 l4 6 M40 58 l4 6" stroke={accent} strokeWidth="2" />
          </>
        );
      } else if (variant === 2) {
        face = (
          <>
            <path d="M30 22 q-8 -12 -2 -16 M50 22 q8 -12 2 -16" stroke={dark} strokeWidth="2" fill="none" />
            <circle cx="30" cy="8" r="2" fill={accent} />
            <circle cx="52" cy="8" r="2" fill={accent} />
            <ellipse cx="40" cy="42" rx="16" ry="14" fill={body} />
            <Eye cx={34} cy={40} />
            <Eye cx={46} cy={40} />
          </>
        );
      } else if (variant === 3) {
        face = (
          <>
            <path d="M32 28 q8 -20 16 0" fill={accent} />
            <circle cx="40" cy="42" r="16" fill={body} />
            <ellipse cx="40" cy="48" rx="6" ry="4" fill={belly} />
            <Eye cx={34} cy={40} />
            <Eye cx={46} cy={40} />
          </>
        );
      } else if (variant === 4) {
        face = (
          <>
            <ellipse cx="34" cy="40" rx="16" ry="14" fill={body} />
            <ellipse cx="54" cy="44" rx="10" ry="6" fill={belly} />
            <circle cx="62" cy="44" r="1.6" fill={dark} />
            <Eye cx={30} cy={36} />
            <Eye cx={42} cy={36} />
          </>
        );
      } else {
        face = (
          <>
            <ellipse cx="22" cy="40" rx="10" ry="6" fill={accent} />
            <ellipse cx="58" cy="40" rx="10" ry="6" fill={accent} />
            <circle cx="40" cy="28" r="10" fill={belly} />
            <ellipse cx="40" cy="46" rx="14" ry="12" fill={body} />
            <Eye cx={36} cy={27} />
            <Eye cx={44} cy={27} />
          </>
        );
      }
    }
  }

  return (
    <>
      <Flourish look={look} x={anchor.x} y={anchor.y} behind />
      {face}
      <Marks look={look} cx={spot.x} cy={spot.y} />
      <Flourish look={look} x={anchor.x} y={anchor.y} />
    </>
  );
}

export function CreatureArt({
  name,
  id,
  className,
}: {
  name: string;
  id?: string;
  className?: string;
}) {
  const portraitId = portraitIdFor(id, name);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [portraitId]);

  if (portraitId && !failed) {
    return (
      // next/image dropped the GitHub Pages folder, so these use a plain image.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={assetPath(`/creatures/${portraitId}.jpg`)}
        alt=""
        draggable={false}
        className={`${className ?? ""} pointer-events-none object-contain`}
        onError={() => setFailed(true)}
      />
    );
  }

  const look = lookFor(name);
  return (
    <Frame className={className}>
      {look.classic ? classicPicture(look.name) : portrait(look)}
    </Frame>
  );
}
