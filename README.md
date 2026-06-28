# Debate the Wizard

A live pixel-art debate game. You pick a side, an AI wizard argues the other. Every claim either
side makes is grounded in fresh **You.com** search results with citations shown on
screen, and a **Judge** model fact-checks each claim against those sources. Survive
fact-checking and score points. Get caught making an unsupported claim and lose the round.

Search isn't decoration here, it's the win condition: no search means no grounding, no
grounding means no scoring, no scoring means no game. The whole backend (Postgres, edge
functions, model gateway, deploy) runs on **InsForge**.

## How it plays

A **round** is one exchange; a **match** is best-of-N. The player and the wizard run
through the *same* search + judge pipeline, so the wizard can get fact-checked and lose
too:

```
1. Room created -> topic chosen -> player takes FOR, wizard takes AGAINST.
2. Player submits an argument -> A single submit-argument API call handles the full turn:
   - Judge extracts the player's key claim, searches You.com, and scores it.
   - Debater Agent synthesizes a rebuttal for the wizard, avoiding past claims.
   - Judge scores the wizard's rebuttal.
   - Both claims and their scores are saved to Postgres.
3. The response returns both the player and wizard's verdicts simultaneously.
4. The frontend animates the spell combat based on the verdicts (supported/unsupported/misleading).
5. Repeat for N rounds -> tally -> reveal winner with the full citation trail.
```

## Architecture

| Component | Built on | Job |
|---|---|---|
| Frontend | Vanilla JS, HTML, CSS | Pixel Game Boy UI, spell combat animations, citation side-panel |
| Game logic | InsForge Edge Functions (Deno) | `/submit-argument`, `/create-room`, `/record-match` |
| AI Workflow | TypeScript (`agent-workflow`) | Orchestrates Claim Extraction, Research, Fact Checking, Fallacy Detection, Debating, and Judging |
| Model Gateway | InsForge Model Gateway -> Claude | Powers all the AI sub-agents in the workflow |
| Grounding | You.com Search API | Real-time, citation-backed snippets — arms the wizard *and* verifies every claim |
| Persistence | InsForge Postgres | rooms, players, claims, citations |
| Secrets | InsForge Secret Manager | Holds the You.com and InsForge keys |

## Status

- [x] Database schema — `backend/migrations/`
- [x] `submit-argument` edge function — single-pass orchestration for the entire debate turn
- [x] Evidence-grounded agent workflow — Claim + Research, Fact Check, Fallacy Detection, Debater, Judge
- [x] Postgres persistence in the functions (claims/citations/scores)
- [x] Pixel art frontend (Vanilla JS) integrated with the backend
- [x] Integrity guards: one-turn-per-round, finished-room lock, round bounds, idempotent recomputed scoring
- [x] Demo seed topics with built-in factual traps
- [x] `agent-workflow` stateful history integration

## Repo layout

```
backend/migrations/            Postgres schema (InsForge CLI migrations)
backend/functions/             InsForge Edge Functions (create-room, submit-argument, etc)
backend/agent-workflow/        Local TypeScript multi-agent debate workflow
frontend/                      The Pixel Game Boy vanilla JS static frontend
docs/agent-workflow.md         Agent workflow diagram, responsibilities, and contracts
docs/backend-architecture.md   Backend edge function contracts and API specs
SETUP.md                       Init -> deploy -> test, step by step
```

See **[docs/agent-workflow.md](docs/agent-workflow.md)** for the evidence-grounded
agent workflow, including the Mermaid diagram and data contracts.
See **[docs/backend-architecture.md](docs/backend-architecture.md)** for how the edge functions coordinate the game loop.

## Getting started

To run the frontend locally:
```bash
cd frontend
npx serve . -p 3000
```
Open `http://localhost:3000` to play.

See **[SETUP.md](SETUP.md)** — InsForge login, schema, secrets, and deployment instructions for the backend.
