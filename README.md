# Debate the Wizard

A live debate game. You pick a side, an AI wizard argues the other. Every claim either
side makes is grounded in fresh **You.com** search results with citations shown on
screen, and a **Judge** model fact-checks each claim against those sources. Survive
fact-checking and score points. Get caught making an unsupported claim and lose the round.

Search isn't decoration here, it's the win condition: no search means no grounding, no
grounding means no scoring, no scoring means no game. The whole backend (Postgres, edge
functions, realtime, model gateway, deploy) runs on **InsForge**.

## How it plays

A **round** is one exchange; a **match** is best-of-N. The player and the wizard run
through the *same* search + judge pipeline, so the wizard can get fact-checked and lose
too:

```
1. Room created -> topic chosen -> player takes SIDE A, wizard takes SIDE B.
2. Player submits an argument -> Judge extracts the key claim
   -> You.com search on that claim -> Judge rules:
        supported   -> +points, green + citation
        unsupported -> +0, "no source found"
        misleading  -> penalty, red + the contradicting source
3. Wizard turn: same pipeline, grounded rebuttal, same Judge (it can lose too).
4. Repeat for N rounds -> tally -> reveal winner with the full citation trail.
```

## Architecture

| Component | Built on | Job |
|---|---|---|
| Frontend | React + Vite + Tailwind | Side picker, live arena, citation panel, verdict reveal |
| Realtime sync | InsForge Realtime (pub/sub) | One channel per room; pushes round state, verdicts, scores |
| Game logic | InsForge Edge Functions (Deno) | `/judge-claim`, `/wizard-turn` |
| Wizard + Judge | InsForge Model Gateway -> Claude | Argues a side / extracts + rules on each claim |
| Grounding | You.com Search API | Real-time, citation-backed snippets — arms the wizard *and* verifies every claim |
| Persistence | InsForge Postgres | rooms, players, claims, citations |
| Secrets | InsForge Secret Manager | Holds the You.com key server-side |

## Status

Backend skeleton (build-order step 1):

- [x] Database schema — `migrations/20260628120000_init.sql`
- [x] `/judge-claim` edge function — You.com search + Claude judge, strict JSON, graceful fallbacks
- [x] curl smoke test — `scripts/test-judge.sh`
- [ ] `/wizard-turn`
- [ ] Realtime channel + score broadcast
- [ ] Postgres persistence in the functions
- [ ] React arena frontend

## Repo layout

```
migrations/                 Postgres schema (InsForge CLI migrations)
functions/judge-claim/      The core search + judge edge function
scripts/test-judge.sh       curl smoke test for the deployed function
SETUP.md                    Init -> deploy -> test, step by step
.env.example                Secrets the function expects
```

## Getting started

See **[SETUP.md](SETUP.md)** — InsForge login, schema, secrets, deploy, and the
curl test that proves the core loop works.
