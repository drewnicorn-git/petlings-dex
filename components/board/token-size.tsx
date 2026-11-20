"use client";

export type TokenSize = "small" | "medium" | "large";

export const TOKEN_METRICS: Record<
  TokenSize,
  { image: number; frame: string; width: number; height: number }
> = {
  small: { image: 40, frame: "w-20", width: 80, height: 108 },
  medium: { image: 64, frame: "w-28", width: 112, height: 132 },
  large: { image: 112, frame: "w-40", width: 160, height: 188 },
};

const STORAGE_KEY = "petlings-token-size";

export function readTokenSize(): TokenSize {
  if (typeof window === "undefined") return "medium";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "small" || saved === "medium" || saved === "large") return saved;
  return "medium";
}

export function writeTokenSize(size: TokenSize) {
  window.localStorage.setItem(STORAGE_KEY, size);
}

const OPTIONS: { id: TokenSize; label: string }[] = [
  { id: "small", label: "Small" },
  { id: "medium", label: "Medium" },
  { id: "large", label: "Large" },
];

export function TokenSizePicker({
  value,
  onChange,
}: {
  value: TokenSize;
  onChange: (size: TokenSize) => void;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Creature image size">
      <span className="mr-1 text-xs font-semibold text-muted-foreground">Size</span>
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className="rounded-full border px-2.5 py-1 text-xs font-semibold aria-pressed:bg-foreground aria-pressed:text-background"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
