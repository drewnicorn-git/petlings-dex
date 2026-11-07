"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreatureArt } from "@/components/creature-art";
import { Button } from "@/components/ui/button";
import { assetPath } from "@/lib/asset-path";

const CHOICE_KEY = "petlings-picture-style";

const ANIMALS = ["Cat", "Bunny", "Chick"] as const;

const LOOKS = [
  {
    id: "sticker",
    name: "Sticker",
    note: "Flat color and a dark outline. The animal reads quickly even at the small size on the board.",
    files: {
      Cat: "style-sticker-cat.jpg",
      Bunny: "style-sticker-bunny.jpg",
      Chick: "style-sticker-chick.jpg",
    },
  },
  {
    id: "storybook",
    name: "Storybook",
    note: "Painted fur, feathers, and soft shading. Closest to the real animal, still cute.",
    files: {
      Cat: "style-story-cat.jpg",
      Bunny: "style-story-bunny.jpg",
      Chick: "style-story-chick.jpg",
    },
  },
  {
    id: "chibi",
    name: "Chibi",
    note: "Big glossy eyes and soft round bodies. A mascot look with the real markings kept.",
    files: {
      Cat: "style-chibi-cat.jpg",
      Bunny: "style-chibi-bunny.jpg",
      Chick: "style-chibi-chick.jpg",
    },
  },
] as const;

export function StylePicker() {
  const [choice, setChoice] = useState<string | null>(null);

  useEffect(() => {
    setChoice(window.localStorage.getItem(CHOICE_KEY));
  }, []);

  function pick(id: string) {
    window.localStorage.setItem(CHOICE_KEY, id);
    setChoice(id);
  }

  const chosen = LOOKS.find((look) => look.id === choice);

  return (
    <div className="min-h-svh">
      <header className="border-b px-4 py-4 sm:px-6">
        <Link href="/" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
          Back to the board
        </Link>
        <h1 className="mt-2 font-heading text-3xl">Picture styles</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          These are three ways to draw Cat, Bunny, and Chick so they look like the animals and stay
          cute. Pick one. The rest of the list stays as it is until that choice is applied.
        </p>
        {chosen ? (
          <p className="mt-3 text-sm font-semibold" aria-live="polite">
            You picked {chosen.name}.
          </p>
        ) : null}
      </header>
      <main className="space-y-6 px-4 py-4 sm:px-6">
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="font-heading text-lg">On the board now</h2>
          <div className="mt-3 grid grid-cols-3 gap-3 sm:max-w-md">
            {ANIMALS.map((name) => (
              <figure key={name} className="text-center">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl bg-background">
                  <CreatureArt name={name} className="h-20 w-20" />
                </div>
                <figcaption className="mt-1 text-xs font-semibold">{name}</figcaption>
              </figure>
            ))}
          </div>
        </section>
        {LOOKS.map((look) => {
          const selected = choice === look.id;
          return (
            <section
              key={look.id}
              className={`rounded-2xl border bg-card p-4 ${selected ? "ring-2 ring-primary" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-heading text-2xl">{look.name}</h2>
                  <p className="mt-1 max-w-xl text-sm text-muted-foreground">{look.note}</p>
                </div>
                <Button type="button" variant={selected ? "default" : "outline"} onClick={() => pick(look.id)}>
                  {selected ? "Picked" : `Use ${look.name}`}
                </Button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {ANIMALS.map((name) => (
                  <figure key={name} className="text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={assetPath(`/style-samples/${look.files[name]}`)}
                      alt={`${look.name} drawing of a ${name.toLowerCase()}`}
                      className="aspect-square w-full rounded-2xl bg-background object-contain"
                    />
                    <figcaption className="mt-2 text-sm font-semibold">{name}</figcaption>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={assetPath(`/style-samples/${look.files[name]}`)}
                      alt=""
                      className="mx-auto mt-2 h-16 w-16 rounded-xl bg-background object-contain"
                    />
                  </figure>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
