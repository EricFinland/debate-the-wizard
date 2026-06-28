# The wizard turn — how the AI debater plays a round

When you trigger the wizard, three pieces work together: **`wizard-turn`** generates a
grounded rebuttal, **`judge-claim`** fact-checks it, and **`advance-wizard`** persists the
result and moves the match forward. Critically, the wizard runs through the *same* Judge
pipeline as the player, so the wizard can also get caught making a misleading claim and
lose a round. That's the demo money shot.

Orchestration source: [`functions/advance-wizard/index.ts`](../functions/advance-wizard/index.ts).
Judge source: [`functions/judge-claim/index.ts`](../functions/judge-claim/index.ts)
(see [judging-pipeline.md](judging-pipeline.md)).

## The three functions

| Function | Track | Role |
|---|---|---|
| `wizard-turn` | agent pipeline | **Pure.** Generates a grounded rebuttal for the wizard's side. May also judge itself. |
| `judge-claim` | agent pipeline | **Pure.** You.com grounding + single multi-dimension verdict. |
| `advance-wizard` | infra/glue | Orchestrates: calls the wizard, ensures it's judged, persists, scores, advances the match. |

## End-to-end flow (one wizard turn)

`advance-wizard` receives `POST { room_id, round_no, opponent_argument? }` and runs:

### 1. Guard the turn
Before anything else, integrity checks (all return early on failure):
- **Room exists** -> else `404`.
- **Room not finished** -> a turn on a `finished` room returns `409` (finished rooms are
  read-only).
- **Round in bounds** -> `round_no > rounds_total` returns `400`.
- **One wizard turn per round** -> if a `wizard` claim already exists for
  `(room_id, round_no)`, returns `409`. No double-scoring under retries.

### 2. Generate the rebuttal (`wizard-turn`)
Calls the agent-pipeline function:
```
POST /functions/wizard-turn
{ room_id, topic, side_label: "B", round_no, opponent_argument }
```
- `opponent_argument` (the player's last argument, if passed) lets the wizard actually
  rebut rather than monologue.
- **Contract:** `wizard-turn` must return at least `{ argument: string }`, a punchy 2-3
  sentence grounded rebuttal that cites a You.com snippet. It **may** also return the full
  judged shape (`verdict, key_claim, rationale, points, scores, fallacies, citations,
  citation_index`).
- **Not-deployed handling:** if `wizard-turn` 404s, `advance-wizard` returns a clear `503`
  ("wizard-turn is not deployed yet"); any other failure returns `502`. An empty
  `argument` also returns `502`. The orchestrator never persists a non-turn.

### 3. Ensure it's judged (trust-or-judge)
```ts
const judged = typeof wiz?.verdict === "string" ? wiz : await runJudge(argument, room.topic);
```
- If `wizard-turn` **already judged itself** (returned a `verdict`), `advance-wizard`
  trusts it and skips re-judging, one fewer round trip.
- If it returned **only `argument`**, `advance-wizard` runs it through `judge-claim`
  itself.

Either way the wizard's claim passes through the **identical** Judge the player faces:
same You.com grounding, same verdict logic, same scoring. This is what makes the wizard
fact-checkable, and beatable.

### 4. Persist the claim + citations
- Inserts a row into `claims` with `author: "wizard"` and the judged fields
  (`key_claim, verdict, rationale, points, scores, fallacies`).
- Inserts the returned `citations` into the `citations` table, linked by `claim_id`.
  These are the wizard's You.com sources, shown live and added to the recap citation trail.

### 5. Recompute the wizard's score (idempotent)
`recomputeScore(room_id, "B", "wizard")` sums **all** of the wizard's `claims.points` and
writes that total to `players.score` for side B. Score is always recomputed from the
claims (the source of truth), never incremented in place, so retries and races can't
double-count, and an edited row self-heals.

Game points come from the verdict (supported +10, unsupported 0, misleading -5); the
four-dimension `scores` are display/tiebreak only.

### 6. Advance or finish the match
If `round_no >= rounds_total`, `advance-wizard` flips `room.status` to `finished`
(the match becomes read-only and `get-room` can reveal the winner). Otherwise the room
stays active for the next round.

### 7. Respond
Returns `{ claim, citations, score, citation_index, room }`. The UI can render the
wizard's verdict and updated score directly from this response, and clients subscribed to
InsForge realtime DB-change events on `claims` / `players` get the same update pushed
automatically.

## Full game loop (both sides)

```
create-room (topic_id: "nuclear-climate", rounds_total)   -> room, players[A,B]
loop rounds 1..N:
  player types argument
    -> submit-argument(room_id, round, argument)   [judge-claim -> persist -> score A]
  trigger wizard
    -> advance-wizard(room_id, round, opponent_argument)
         [wizard-turn -> judge-claim (or trust self-judge) -> persist -> score B
          -> finish room on the last round]
get-room(room_id)   -> final scores, winner, full citation trail (recap)
```

## Why the wizard can lose (the point)

The wizard is not privileged. It argues through You.com grounding and is ruled by the same
Judge as the human. On a trap topic like `nuclear-climate`, a tempting-but-false wizard
claim (e.g. "nuclear emits more lifecycle CO2 than coal") gets ruled **`misleading` (-5)**
with a real You.com citation that contradicts it, on screen. The AI doesn't get to lie
either, and that's the moment that sells the whole game.
