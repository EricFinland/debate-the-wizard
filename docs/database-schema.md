# Database schema

Postgres on InsForge. Source of truth: [`migrations/20260628120000_init.sql`](../migrations/20260628120000_init.sql).
Apply with `npx @insforge/cli db migrations up --all`.

```
rooms
  id            uuid pk            default gen_random_uuid()
  topic         text not null
  status        text not null      lobby | active | finished   (default 'lobby')
  rounds_total  int  not null      default 5
  created_at    timestamptz        default now()

players
  id        uuid pk
  room_id   uuid -> rooms(id)  on delete cascade
  side      text               'A' (human) | 'B' (wizard)
  score     int  not null      default 0

claims
  id         uuid pk
  room_id    uuid -> rooms(id)  on delete cascade
  round_no   int
  author     text               'player' | 'wizard'
  argument   text               full submitted text
  key_claim  text               the testable claim the Judge extracted
  verdict    text               supported | unsupported | misleading
  rationale  text               Judge's one-liner
  points     int  not null      default 0
  scores     jsonb              { factual_accuracy, logic, evidence, persuasiveness }  (0-10 each)
  fallacies  jsonb not null     default '[]'  -- ["straw man", ...]
  created_at timestamptz        default now()

citations
  id         uuid pk
  claim_id   uuid -> claims(id) on delete cascade
  title      text
  url        text
  snippet    text               the exact passage that grounded/contradicted the claim
```

Indexes: `players(room_id)`, `claims(room_id)`, `claims(room_id, round_no)`, `citations(claim_id)`.

## Notes
- **Scoring:** `claims.points` is the game score for that turn and comes from the
  verdict (supported +10, unsupported 0, misleading −5). `players.score` is the
  running total, bumped by `submit-argument` (side A) and `advance-wizard` (side B).
- **Scorecard:** `claims.scores` + `claims.fallacies` power the per-claim scorecard
  in the UI and tiebreaks; they don't change `points`.
- **Recap:** the `citations` table is the demo's strongest moment — the full
  source trail. `get-room` returns every claim with its citations attached.
- **Realtime:** UI updates come from subscribing to row changes on `claims` /
  `players` filtered by `room_id` (see backend-architecture.md), so writes here
  are what drive the live arena.
