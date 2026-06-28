# Backend architecture & team contracts

Everything runs on **InsForge**: Postgres + edge functions (Deno) + realtime + the
model gateway (Claude). Function source lives in `backend/functions/src` and is
bundled into one deployable file per function with `npm run build:functions`.
Deploy from `backend/functions/dist/<slug>.ts`, not directly from source modules.

## Three tracks (so we don't collide)

| Track | Owner | Owns |
|---|---|---|
| **Frontend** | teammate 1 | Next.js arena, side picker, citation panel, scorecard, verdict reveal. Talks to the edge functions over HTTPS + subscribes to realtime. |
| **Agent pipeline** | teammate 2 | `judge-claim` and `wizard-turn`. Both **pure**: take inputs, call You.com + Claude, return JSON. No DB, no realtime. |
| **The rest (infra/glue)** | Eric (`Eric` branch) | rooms/session lifecycle, persistence, scoring, realtime fan-out, leaderboard, health, demo seed topics. Reuses shared source modules and persists/broadcasts. |

The key idea from the plan holds: **the search+judge pipeline is built once and called twice** (player and wizard). Orchestration imports the shared pipeline at build time and stores the result.

## Edge function inventory

### Pure (agent-pipeline track)
- **`judge-claim`** — `POST { argument, topic }` → `{ key_claim, verdict, rationale, points, scores{factual_accuracy,logic,evidence,persuasiveness}, fallacies[], citations[], citation_index }`. (Built — see repo README for the full contract.)
- **`wizard-turn`** — see the contract below; teammate 2 implements it.

### Orchestration / infra (this branch)
- **`create-room`** — `POST { topic? | topic_id?, rounds_total? }` → `{ room, players[A,B], topic_meta }`. Creates the room + both players. `topic_id` uses a pre-vetted demo topic.
- **`submit-argument`** — `POST { room_id, round_no, argument }` → `{ claim, citations[], score, citation_index }`. Player turn: runs `judge-claim`, persists the claim + citations, bumps side-A score.
- **`advance-wizard`** — `POST { room_id, round_no, opponent_argument? }` → `{ claim, citations[], score, citation_index, room }`. Wizard turn: calls `wizard-turn`, judges it if needed, persists, bumps side-B score, and flips `room.status` to `finished` after the last round.
- **`get-room`** — `POST { room_id }` → `{ room, players, scores{A,B}, claims[](each with citations[]), winner }`. State for reconnect, spectating, and the recap.
- **`leaderboard`** — `GET` → `{ leaderboard[] }`. Top human (side-A) scores with their topic.
- **`health`** — `GET` → `{ ok, service, time, config{gateway,db,youcom} }`. Liveness + secret-presence (booleans only).

## Contract for `wizard-turn` (teammate 2 implements)

Orchestration calls it like this:

```
POST /functions/wizard-turn
{ "room_id": "...", "topic": "...", "side_label": "B", "round_no": 2, "opponent_argument": "..." }
```

It **must** return at least:
```json
{ "argument": "a punchy 2-3 sentence grounded rebuttal that cites a You.com snippet" }
```

It **may** also return the full judged shape (same fields as `judge-claim`:
`verdict, key_claim, rationale, points, scores, fallacies, citations, citation_index`).
- If it does, `advance-wizard` trusts it and skips re-judging.
- If it returns only `argument`, `advance-wizard` runs it through `judge-claim` itself.

Either way the wizard goes through the same Judge, so **it can also get caught** —
that's the demo money shot.

## Realtime: how the UI stays live

We do **not** publish from the edge functions. Instead, clients subscribe to
**InsForge realtime database-change events** on this room's rows. Every persisted
claim / score update is pushed automatically.

Frontend pattern (Socket.IO):

```js
import { io } from "socket.io-client";
const socket = io(INSFORGE_URL, { auth: { token: ANON_KEY } });

// one logical channel per room
socket.emit("realtime:subscribe", { channel: `room:${roomId}` });

// react to new claims (verdicts) and score changes
socket.on("claims:insert", (msg) => renderVerdict(msg.payload));   // exact event
socket.on("players:update", (msg) => updateScore(msg.payload));     // names per
// ...confirm the realtime event naming with: npx @insforge/cli metadata
```

> Confirm the exact DB-change event names/filters with `npx @insforge/cli metadata`
> and the realtime docs; if table-change subscriptions need enabling, do it there.
> Fallback that always works: after each action, the action's HTTP response already
> contains the verdict/score, and `get-room` returns full state for a hard refresh.

## Full game loop (sequence)

```
create-room (topic, sides)            -> room_id, players
loop rounds 1..N:
  player types argument
    -> submit-argument(room_id, round, argument)   [judge -> persist -> score]
    -> realtime pushes the player's verdict + new score
  advance-wizard(room_id, round)                    [wizard-turn -> judge -> persist -> score]
    -> realtime pushes the wizard's verdict + new score
get-room(room_id)                      -> final scores, winner, full citation trail (recap)
```

## Integrity guards (orchestration functions)

- **One turn per side per round** — duplicate `submit-argument` / `advance-wizard`
  for the same `(room_id, round_no)` returns `409`. No double-scoring.
- **Finished rooms are read-only** — turns on a `finished` room return `409`.
- **Round bounds** — `round_no > rounds_total` returns `400`.
- **Idempotent scoring** — `players.score` is *recomputed* as the sum of that
  player's `claims.points` on every turn, never incremented in place. Safe under
  retries/races and self-healing if a row is edited.
- **Input cap** — `argument` over 4000 chars returns `400`.

## Typed client

Frontend imports `client/` instead of hand-rolling fetches:

```ts
import { createDebateClient } from "../client";
const api = createDebateClient(process.env.NEXT_PUBLIC_INSFORGE_URL!);
const { room } = await api.createRoom({ topic_id: "nuclear-climate" });
const turn = await api.submitArgument({ room_id: room.id, round_no: 1, argument });
```

All request/response types live in `client/types.ts` and mirror the contracts above.

## Env / secrets every function reads

- `INSFORGE_API_URL` — project base (model gateway + functions host)
- `INSFORGE_API_KEY` — bearer for the gateway + data API
- `INSFORGE_DATA_URL` — *optional*; only if the records API is on a different host
  than the gateway (defaults to `INSFORGE_API_URL`)
- `YOUCOM_API_KEY` — judge/wizard only

See `SETUP.md`.
