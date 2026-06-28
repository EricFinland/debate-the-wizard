# Debate the Wizard

A pixel, Game Boy style 1-vs-1 debate battle. You face an AI wizard and duel with
arguments instead of spells. State a claim, then each turn you cast an argument: a
Judge grounds it in fresh **You.com** search and rules it supported, unsupported, or
misleading. A supported claim strikes the wizard; a misleading one backfires on you.
The wizard argues back and gets fact-checked too, so it can lose. Drop the other
side's HP to win.

**Play it live: https://atjgzcv9.insforge.site**

## Why search and the backend are load-bearing

- **You.com** is the win condition. Every claim, yours and the wizard's, is grounded
  in live You.com search, and the sources are shown on screen each turn. No search
  means no grounding, no verdict, no damage.
- **InsForge** runs the entire backend: Postgres, edge functions (the judge + wizard
  pipeline), the AI model gateway, auth, and the hosted deploy. One platform.

## How it plays

1. Pick your wizard, choose a difficulty (easy to impossible), and state a claim
   (or hit PICK FOR ME and choose a side).
2. FIGHT: type an argument. It is searched on You.com and judged.
   - supported: you strike the enemy wizard
   - misleading: it backfires and you take damage
   - unsupported: it fizzles
3. The wizard rebuts with its own grounded argument and is judged the same way.
4. First to drop the opponent's HP (or higher HP after the rounds) wins.

Sign in with an email account to save progress. OAuth (Google or GitHub) is only
needed to appear on the leaderboard.

## Tech

- **Frontend:** vanilla HTML/CSS/JS pixel game (no build), hosted on InsForge.
- **Backend (InsForge edge functions, Deno):** `create-room`, `submit-argument`,
  `advance-wizard`, `get-room`, `leaderboard`, `record-match`, plus the judge
  pipeline. Each turn calls You.com Search and the model gateway (Claude).
- **Data:** InsForge Postgres (rooms, players, claims, citations, profiles).

## Run locally

The game is static. Serve the repo root and open it:

```
npx serve .
# then open the printed URL
```

It talks to the live InsForge backend, so no local backend is needed.

## Repo layout

```
index.html, css/, js/, img/, fonts/   the pixel battle game (the live frontend)
functions/                            InsForge edge functions (judge + game logic)
migrations/                           Postgres schema
docs/                                 architecture + pipeline notes
```

Built with [You.com](https://you.com) and [InsForge](https://insforge.dev).
