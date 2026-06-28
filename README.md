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

## Team & branches

Three parallel tracks (see [docs/backend-architecture.md](docs/backend-architecture.md) for the contracts):

| Track | Owns |
|---|---|
| **Frontend** | Next.js arena, side picker, citation panel, scorecard, verdict reveal |
| **Agent pipeline** | `judge-claim` (done) + `wizard-turn` — pure search+Claude functions |
| **The rest** (`Eric` branch) | rooms/sessions, persistence, scoring, realtime fan-out, leaderboard, health, seed topics |

## Status

- [x] Database schema — `migrations/20260628120000_init.sql`
- [x] `/judge-claim` edge function — You.com search + Claude judge (one call), strict JSON, graceful fallbacks
- [x] Multi-dimension scorecard per claim (factual accuracy / logic / evidence / persuasiveness) + fallacy detection, all in the single judge call
- [x] curl smoke test — `scripts/test-judge.sh`
- [x] Evidence-grounded agent workflow — Claim + Research, Fact Check, Fallacy Detection, Debater, Judge
- [ ] `/wizard-turn`
- [ ] Realtime channel + score broadcast
- [ ] Postgres persistence in the functions
- [ ] React arena frontend
- [x] `judge-claim` — You.com search + Claude judge (one call), strict JSON, graceful fallbacks
- [x] Multi-dimension scorecard + fallacy detection in the single judge call
- [x] **Orchestration/infra**: `create-room`, `submit-argument`, `advance-wizard`, `get-room`, `leaderboard`, `health`
- [x] Persistence (claims/citations/scores) + realtime via DB-change subscriptions
- [x] Integrity guards: one-turn-per-round, finished-room lock, round bounds, idempotent recomputed scoring, input caps
- [x] Typed client for the frontend — `client/`
- [x] Demo seed topics with built-in factual traps — `seed/topics.json`
- [ ] `wizard-turn` (agent-pipeline track)
- [ ] React arena frontend (frontend track)

## Repo layout

```
backend/functions/src/      Modular source for InsForge edge functions
backend/functions/dist/     Generated one-file deploy bundles
backend/agent-workflow/     Local TypeScript multi-agent debate workflow
migrations/                 Backend-owned Postgres schema (InsForge CLI migrations)
functions/                  Legacy one-file functions retained for reference
docs/agent-workflow.md      Agent workflow diagram, responsibilities, and contracts
scripts/test-judge.sh       curl smoke test for the deployed function
scripts/test-agent-workflow.sh local smoke test for the agent workflow
SETUP.md                    Init -> deploy -> test, step by step
.env.example                Secrets the function expects
```

See **[docs/agent-workflow.md](docs/agent-workflow.md)** for the evidence-grounded
agent workflow, including the Mermaid diagram and data contracts.

Build deployable edge function files with:

```bash
npm run build:functions
```

Deploy generated bundles only, for example:

```bash
npx @insforge/cli functions deploy judge-claim --file backend/functions/dist/judge-claim.ts
```

## `judge-claim` response contract

`POST /functions/judge-claim` with `{ "argument": "...", "topic": "..." }` returns:

```json
{
  "key_claim": "the single testable claim the Judge extracted",
  "verdict": "supported | unsupported | misleading",
  "rationale": "<= 20 words",
  "points": 10,
  "scores": { "factual_accuracy": 8, "logic": 7, "evidence": 9, "persuasiveness": 6 },
  "fallacies": [],
  "citations": [{ "title": "...", "url": "...", "snippet": "..." }],
  "citation_index": 0
}
```

`points` (the game score) comes from `verdict`: supported +10, unsupported 0, misleading −5.
`scores` and `fallacies` drive the on-screen scorecard and tiebreaks. `citation_index`
points at the snippet the Judge relied on (or `null`).

## Getting started

See **[SETUP.md](SETUP.md)** — InsForge login, schema, secrets, deploy, and the
curl test that proves the core loop works.
