# Merge Board

A personal notebook for a pet-merge game. Land Farm and Sea Farm are separate boards. Add creatures and the same-tier combos that make them, drag cartoon tokens together to see what unlocks, and drop a creature in a corner to count the tier 1 pets it takes or to see which same-tier partners are still missing. Tier 8 and above skip that count and instead show how many saved combinations from the tier directly below can make it, plus the unique creatures in those combinations.

This is not the game, and it is not an official guide. The land list lives in `data/merge-board.json`. The sea list lives in `data/sea-board.json`.

## Rules the board keeps

- Only creatures of the same tier can combine. Tiers 1 through 6 use two creatures. Tiers 7, 8, and 9 click the first two together into one pair, then take a third dropped on that pair. With Auto-Generate on, naming that new combo lists the locked pair with the creature you dropped and every same-tier creature alphabetically after it. You type one name, and each combo in the list is saved as its own record for that creature. Drop a locked pair on missing combos to see which third creature is still open.
- Every creature in tiers 1 through 6 can combine with every creature in that tier, including two of the same creature.
- The result is the next tier.
- Land Farm's tier 1 creatures are Chick, Bunny, and Cat. Sea Farm's are Clownfish, Seahorse, and Crab. The counts above the board are how many of those you have for the farm that is open. Switching farms keeps each set of counts, owned creatures, missing combinations, and the disassembly drop. The plus adds a higher-tier creature you already own. For tiers 1 through 6, the best build spends as many of those as fit, highest tiers first, and the still-needed list is only the tier 1 pets left to finish it. Rearranged copies of the same tree are skipped, and every distinct build is still considered. For a tier 7 creature, disassembly stops at the first build that can spend creatures you already own. Editing those counts or the owned list does not recalculate. Drop a creature on Disassemble, including the one already shown, to calculate again. Click one of those bubbles to remove a single copy, and the trash icon clears every added creature on that farm.
- A pair is the same combo in either order, and a trio is the same combo in any order. Two or three of the same creature is allowed.
- A combo cannot loop back into itself.

If you drop a pair that is not saved yet, the board says **New Creature ?** and you can name the result. That writes the creature and the combo.

Every saved creature uses a chibi portrait when one is already prepared for that name. A creature you add later keeps a simple drawing until a portrait with the same name is added.

## Your notes stay in the browser

Creatures, combos, and the tokens on each farm are saved separately in this browser’s local storage. Edit names, tiers, and combos from Land Data or Sea Data.

Land Data exports `merge-board-land.json`. Sea Data exports `merge-board-sea.json`. To make a newer list part of the project, replace `data/merge-board.json` or `data/sea-board.json` with that export. The next time the app loads, it uses the new file and drops browser-only creatures that were not in it. Until that file changes, creatures you add in the browser stay put. Import still replaces the list in this browser only.

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
