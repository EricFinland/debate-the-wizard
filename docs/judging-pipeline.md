# The Judging Pipeline

The Judge is part of the local TypeScript `agent-workflow`, not a standalone deployed
`judge-claim` edge function. `submit-argument` calls the workflow once per round and
persists the resulting player and wizard claims.

Source of truth: [`backend/agent-workflow/agents/judge_agent.ts`](../backend/agent-workflow/agents/judge_agent.ts), [`backend/agent-workflow/index.ts`](../backend/agent-workflow/index.ts), and [`backend/functions/submit-argument/index.ts`](../backend/functions/submit-argument/index.ts).

## Inputs And Outputs

The workflow receives the player's current argument plus prior debate history. It
returns:

- `user_claim_report` with the main claim, supporting claims, and search query.
- `search_evidence` with You.com citations.
- `fact_check_report` and `fallacy_report` for the player argument.
- `ai_rebuttal` and `debater_result` for the wizard response.
- `judge_result` with user score, AI score, winner, and explanation.

`submit-argument` converts this into persisted `claims` rows and the HTTP turn response:
`player_claim`, `wizard_claim`, `player_citations`, `player_score`, `wizard_score`,
`room`, `winner`, and `explanation`.

## Scoring

The workflow scores each side across four 0-25 dimensions and stores the normalized
scorecard on the claim. `submit-argument` also maps the total into the claim `points`
field used for player totals. Player verdict text is derived from the fact-check report:

| Fact-check signal | Persisted verdict |
|---|---|
| any `false` or `mixed` checked claim | `misleading` |
| any `true` checked claim or high reliability | `supported` |
| low reliability | `misleading` |
| otherwise | `unsupported` |

The scores in `players` are recomputed from all claim points for the room, so retries
do not double-count.

## Robustness

- Invalid room, finished room, duplicate player turn, and out-of-range round return early.
- The agent workflow owns model/search failures and should return structured reports.
- The frontend should treat `submit-argument` as the only round-resolution endpoint.
