# Debate the Wizard

A pixel, Game Boy style 1-vs-1 debate battle. You face an AI wizard and duel with
arguments instead of spells. State a claim, then each turn you cast an argument: a
Judge grounds it in fresh **You.com** search and rules it supported, unsupported, or
misleading. A supported claim strikes the wizard; a misleading one backfires on you.
The wizard argues back and gets fact-checked too, so it can lose. Drop the other
side's HP to win.

## Why search and the backend are load-bearing

- **You.com** is the win condition. Every claim, yours and the wizard's, is grounded
  in live You.com search, and the sources are shown on screen each turn. No search
  means no grounding, no verdict, no damage.
- **InsForge** runs the entire backend: Postgres, edge functions, the judge + wizard
  pipeline, the AI model gateway, auth, and the hosted deploy.

## How it plays

1. Pick your wizard, choose a difficulty (easy to impossible), and state a claim
   (or hit PICK FOR ME and choose a side).
2. FIGHT: type an argument. It is searched on You.com and judged.
   - supported: you strike the enemy wizard
   - misleading: it backfires and you take damage
   - unsupported: it fizzles
3. The wizard rebuts with its own grounded argument and is judged the same way.
4. First to drop the opponent's HP, or higher HP after the rounds, wins.

Sign in with an email account to save progress. OAuth (Google or GitHub) is only
needed to appear on the leaderboard.

## Architecture

| Component | Built on | Job |
|---|---|---|
| Frontend | Vanilla JS, HTML, CSS | Pixel Game Boy UI, spell combat animations, citation side-panel |
| Game logic | InsForge Edge Functions (Deno) | `/submit-argument`, `/create-room`, `/record-match` |
| AI Workflow | TypeScript (`backend/agent-workflow`) | Orchestrates claim extraction, research, fact checking, debate, and judging |
| Model Gateway | InsForge Model Gateway -> Claude | Powers the AI workflow |
| Grounding | You.com Search API | Real-time, citation-backed snippets |
| Persistence | InsForge Postgres | rooms, players, claims, citations |

## Repo layout

```
backend/migrations/            Postgres schema (InsForge CLI migrations)
backend/functions/             InsForge Edge Functions (create-room, submit-argument, etc.)
backend/agent-workflow/        Local TypeScript multi-agent debate workflow
frontend/                      The pixel Game Boy vanilla JS static frontend
docs/agent-workflow.md         Agent workflow diagram, responsibilities, and contracts
docs/backend-architecture.md   Backend edge function contracts and API specs
SETUP.md                       Init -> deploy -> test, step by step
```

## Run locally

The game is static. Serve the frontend folder and open it:

```bash
cd frontend
npm run dev
```

It talks to the live InsForge backend, so no local backend is needed.

See **[SETUP.md](SETUP.md)** for InsForge login, schema, secrets, and backend
deployment instructions.

Built with [You.com](https://you.com) and [InsForge](https://insforge.dev).
