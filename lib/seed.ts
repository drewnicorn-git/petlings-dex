import type { Catalog } from "@/lib/types";

export const seedCatalog: Catalog = {
  creatures: [
    { id: "chick", name: "Chick", tier: 1, locked: true },
    { id: "bunny", name: "Bunny", tier: 1, locked: true },
    { id: "cat", name: "Cat", tier: 1, locked: true },
    {
      id: "duck",
      name: "Duck",
      tier: 2,
      note: "Published combo: Chick + Chick. Tier 2 follows the next-tier rule.",
    },
    {
      id: "tiger",
      name: "Tiger",
      tier: 2,
      note: "Shown on the Petlings site. The combo is not published.",
    },
    {
      id: "panda",
      name: "Panda",
      tier: 5,
      note: "Published combo with Snapping Turtle.",
    },
    {
      id: "snapping-turtle",
      name: "Snapping Turtle",
      tier: 5,
      note: "Tier 5 is inferred so it can merge with Panda into River Dragon.",
    },
    {
      id: "river-dragon",
      name: "River Dragon",
      tier: 6,
      note: "Published result of Panda + Snapping Turtle.",
    },
    {
      id: "kraken",
      name: "Kraken",
      tier: 7,
      note: "Shown on the Petlings site. The combo is not published.",
    },
    {
      id: "inferno-lion",
      name: "Inferno Lion",
      tier: 8,
      note: "Shown on the Petlings site. The combo is not published.",
    },
    {
      id: "frost-sovereign",
      name: "Frost Sovereign",
      tier: 10,
      note: "Shown on the Petlings site. The combo is not published.",
    },
    {
      id: "cosmic-dragon",
      name: "Cosmic Dragon",
      tier: 10,
      note: "Shown on the Petlings site. The combo is not published.",
    },
    {
      id: "time-phoenix",
      name: "Time Phoenix",
      tier: 10,
      note: "Published as the top of the Chick line. The steps after Duck are not published.",
    },
  ],
  recipes: [
    {
      id: "chick-chick-duck",
      parentA: "chick",
      parentB: "chick",
      resultId: "duck",
    },
    {
      id: "panda-turtle-river-dragon",
      parentA: "panda",
      parentB: "snapping-turtle",
      resultId: "river-dragon",
    },
  ],
};
