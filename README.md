# Wizard Battle

A front-end-only, Pokémon-style wizard duel game. Pure **HTML / CSS / JS** — no
build step, no dependencies. Built to be wired to a backend later (the storage
layer is isolated for that purpose).

Inspired by the *Pokemon-battle-modular* Game Boy battle system, using the
RgsDev character pack sprites.

## Run it

It must be served over HTTP (the sprite sheets won't load from `file://`):

```bash
cd Debate-the-wizard
python3 -m http.server 8765
# open http://localhost:8765/index.html
```

## Screens / flow

```
MAIN MENU ──NEW GAME──▶ REGISTRATION ──▶ MENU (difficulty) ──▶ BATTLE ──▶ MENU
    └──────CONTINUE (if a save exists)───────────────────────▶ MENU
```

- **Main Menu** — `CONTINUE` (enabled only when a save exists) and `NEW GAME`.
- **Registration** — enter a name + choose a wizard color (Red / Green / Grey /
  Purple). Saved to `sessionStorage`.
- **Menu** — four staffs = difficulty: **Easy / Medium / Hard / Impossible**,
  each with a signature color.
- **Battle** — your wizard vs a bot wizard (color tied to difficulty). Pokémon-style
  HP HUD; FIGHT / WIZARD / PACK / RUN controls. FIGHT casts spells (Fireball,
  Frost Shard, Arcane Bolt, Heal); turn-based; bot AI + stats scale with
  difficulty. `WIZARD`/`PACK` are placeholders kept for later.

## Layout

```
index.html              all four screens as <section>s
css/
  base.css              game-boy frame, vars, shared button
  wizard.css              sprite-sheet animation (idle / attack / hurt / dead)
  screens.css           main menu, registration, difficulty menu, staff images
  battle.css            scene, wizards, HP HUD, dialog + menus
js/
  storage.js            sessionStorage save layer (swap for a backend later)
  wizard.js               color->sheet mapping + animation state helper
  screen-manager.js     show/hide screens
  registration.js       name + color picker
  menu.js               difficulty staffs
  battle.js             turn-based combat loop + bot AI
  main.js               boot + main-menu wiring
img/wizards/              wizard-red/green/grey/purple.png (sprite sheets)
```

## Connecting a backend later

All persistence goes through `js/storage.js` (`load` / `save` / `clear` /
`hasSave`). Replace its body with API calls and the rest of the game is
unchanged. Difficulty tuning lives in `Battle.DIFFICULTY` and the
difficulty→enemy-color map in `Wizard.DIFFICULTY_COLOR`.
