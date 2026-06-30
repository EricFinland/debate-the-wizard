# The Wizard Rebuttal Pipeline

The wizard no longer advances through a separate edge function. A full round runs
inside `submit-argument`: the player argument is researched and checked, the wizard
rebuttal is generated from the same context, both sides are judged, and both claims
are persisted before the HTTP response returns.

Source of truth: [`backend/functions/submit-argument/index.ts`](../backend/functions/submit-argument/index.ts) and [`backend/agent-workflow/index.ts`](../backend/agent-workflow/index.ts).

## Round Flow

1. `submit-argument` validates the room, round bounds, finished status, and duplicate player turns.
2. It loads prior debate history from `claims` and calls `runAgentWorkflow`.
3. The workflow extracts the player's claims, searches You.com, fact-checks the argument, detects fallacies, generates the wizard rebuttal, and runs the judge.
4. The function persists one `player` claim and one `wizard` claim for the round.
5. It writes player citations, recomputes both player scores from `claims.points`, finishes the room on the final round, and returns the full turn result.

## Response Contract

```json
{
  "player_claim": {},
  "wizard_claim": {},
  "player_citations": [],
  "player_score": 0,
  "wizard_score": 0,
  "room": {},
  "winner": "user",
  "explanation": "..."
}
```

The frontend renders the player verdict, wizard rebuttal, score updates, and citations
from this one response. There is no supported `advance-wizard`, `wizard-turn`, or
`judge-claim` edge function in the current backend inventory.

## Why The Wizard Can Lose

The wizard is not privileged. Its rebuttal is judged in the same agent workflow that
evaluates the human argument, and its score is persisted as a normal `wizard` claim.
That keeps the match auditable in `get-room` and the citation recap.
