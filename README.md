# Merge Board

A personal notebook for a pet-merge game. Add creatures and the same-tier combos that make them, drag cartoon tokens together to see what unlocks, and drop a creature in a corner to count how many Chicks, Bunnies, and Cats it takes to make again or to see which same-tier partners are still missing.

This is not the game, and it is not an official guide. The creature list and combos checked into the project live in `data/merge-board.json`. That file is the copy that ships with the app.

## Rules the board keeps

- Only two creatures of the same tier can combine.
- Every creature in a tier can combine with every creature in that tier, including two of the same creature.
- The result is the next tier.
- Chick, Bunny, and Cat are the only tier 1 creatures.
- A pair is the same combo in either order. Two of the same creature is allowed.
- A combo cannot loop back into itself.

If you drop a pair that is not saved yet, the board says **New Creature ?** and you can name the result. That writes the creature and the combo.

Every saved creature uses a chibi portrait. A creature you add later keeps a simple drawing until it has a portrait of its own.

## Your notes stay in the browser

Creatures, combos, and the tokens on the board are saved in this browser’s local storage. Edit names, tiers, and combos from the Data tab.

Export writes a `merge-board.json` file. To make a newer list part of the project, replace `data/merge-board.json` with that export. The next time the app loads, it uses the new file and drops browser-only creatures that were not in it. Until that file changes, creatures you add in the browser stay put. Import still replaces the list in this browser only.

## Run it locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:3847.

```bash
npm test
npm run build
```

## GitHub Pages

`.github/workflows/pages.yml` builds a static export and deploys it with GitHub Actions. In the repository settings, set Pages to deploy from GitHub Actions. The site is served from the repository name, unless the repository is a `*.github.io` user site.
