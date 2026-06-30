# Database schema

Postgres on InsForge. Source of truth: [`migrations/20260628120000_init.sql`](../backend/migrations/20260628120000_init.sql).
Apply with `npx @insforge/cli db migrations up --all`.

```
rooms
  id            uuid pk            default gen_random_uuid()
  topic         text not null
  status        text not null      lobby | active | finished   (default 'lobby')
  rounds_total  int  not null      default 5
  difficulty    text not null      novice | adept | archmage | impossible (default 'adept')
  host_user_id  text               optional frontend/client user id
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
  taunt      text               wizard flavor text for the turn
  search_query text             query used for live grounding
  created_at timestamptz        default now()

citations
  id         uuid pk
  claim_id   uuid -> claims(id) on delete cascade
  title      text
  url        text
  snippet    text               the exact passage that grounded/contradicted the claim

profiles
  user_id      text pk
  display_name text
  avatar_url   text
  wins         int not null      default 0
  losses       int not null      default 0
  ties         int not null      default 0
  total_score  int not null      default 0
  verified     boolean not null  default false
  updated_at   timestamptz      default now()
```

Indexes: `players(room_id)`, `claims(room_id)`, `claims(room_id, round_no)`,
`citations(claim_id)`, `profiles(total_score desc)`, `rooms(status)`.

## Notes
- **Scoring:** `claims.points` stores the normalized judge total for that turn.
  `players.score` is the running total, recomputed by `submit-argument` for both
  side A and side B.
- **Scorecard:** `claims.scores` + `claims.fallacies` power the per-claim scorecard
  in the UI and tiebreaks; they don't change `points`.
- **Recap:** the `citations` table is the demo's strongest moment — the full
  source trail. `get-room` returns every claim with its citations attached.
- **Frontend state:** the current frontend uses the `submit-argument` and `get-room`
  HTTP responses directly; the persisted rows remain the source of truth for recaps.
- **Topics:** curated frontend topics are sent to `create-room` as plain text. The
  database stores the chosen text in `rooms.topic`; there is no backend topic seed.
