# Merge Board

A personal notebook for a pet-merge game. Add creatures and the same-tier combos that make them, drag cartoon tokens together to see what unlocks, and drop a creature in the corner to count how many Chicks, Bunnies, and Cats it takes to make again.

This is not the game, and it is not an official guide. The starter list includes only the creatures and combos published on the Petlings site, plus Snapping Turtle at tier 5 so the published Panda merge can be stored. Everything else is yours to type in.

## Rules the board keeps

- Only two creatures of the same tier can combine.
- The result is the next tier.
- Chick, Bunny, and Cat are the only tier 1 creatures.
- A pair is the same combo in either order. Two of the same creature is allowed.
- A combo cannot loop back into itself.

If you drop a pair that is not saved yet, the board says **New Creature ?** and you can name the result. That writes the creature and the combo.

## Your notes stay in the browser

Creatures, combos, and the tokens on the board are saved in this browser’s local storage. Export a JSON file from the Data tab if you want a copy, and import it on another browser. Deploying the site does not upload that notebook.

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
