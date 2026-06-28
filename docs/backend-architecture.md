# Backend architecture & team contracts

Everything runs on **InsForge**: Postgres + edge functions (Deno) + realtime + the model gateway. 
Edge functions deploy one file each (`npx @insforge/cli functions deploy <slug> --file <path>`), so each function is self-contained.

## Architecture Core

The entire AI logic (debating, research, logic checking, scoring) lives in `backend/agent-workflow`. 
This workflow is stateful (receives debate history) and is the core "brain" of the game.

The edge functions in `backend/functions` act as orchestration glue: they fetch the DB state, pass it to the `agent-workflow`, and save the result. 

Because the `agent-workflow` evaluates both the player and the wizard in a single pass, the debate round is processed simultaneously.

## Edge function inventory

- **`create-room`** — `POST { topic? | topic_id?, rounds_total?, difficulty? }` → `{ room, players[A,B], topic_meta }`. Creates the room + both players.
- **`submit-argument`** — `POST { room_id, round_no, argument }` → `{ player_claim, wizard_claim, player_score, wizard_score, room, winner, explanation }`. Runs the core `agent-workflow` with history, evaluating the player's argument and synthesizing the wizard's rebuttal simultaneously. Persists both claims and updates scores.
- **`get-room`** — `POST { room_id }` → `{ room, players, scores{A,B}, claims[](each with citations[]), winner }`. State for reconnect, spectating, and the recap.
- **`leaderboard`** — `GET` → `{ leaderboard[] }`. Top human (side-A) scores with their topic.
- **`health`** — `GET` → `{ ok, service, time, config{gateway,db,youcom} }`. Liveness + secret-presence (booleans only).

## Realtime: how the UI stays live

We do **not** publish from the edge functions. Instead, clients subscribe to **InsForge realtime database-change events** on this room's rows. Every persisted claim / score update is pushed automatically.

Frontend pattern (Socket.IO):

```js
import { io } from "socket.io-client";
const socket = io(INSFORGE_URL, { auth: { token: ANON_KEY } });

// one logical channel per room
socket.emit("realtime:subscribe", { channel: `room:${roomId}` });

// react to new claims (verdicts) and score changes
socket.on("claims:insert", (msg) => renderVerdict(msg.payload));
socket.on("players:update", (msg) => updateScore(msg.payload));
```

## Full game loop (sequence)

```
create-room (topic, sides)            -> room_id, players
loop rounds 1..N:
  player types argument
    -> submit-argument(room_id, round, argument)   [runs agent-workflow -> persists both claims -> updates scores]
    -> realtime pushes the new claims + scores
get-room(room_id)                      -> final scores, winner, full citation trail (recap)
```

## Integrity guards (orchestration functions)

- **One turn per round** — duplicate `submit-argument` for the same `(room_id, round_no)` returns `409`.
- **Finished rooms are read-only** — turns on a `finished` room return `409`.
- **Round bounds** — `round_no > rounds_total` returns `400`.
- **Idempotent scoring** — scores are *recomputed* as the sum of that player/wizard's `claims.points` on every turn, never incremented in place. Safe under retries/races and self-healing.

## Typed client

Frontend imports `backend/client/` instead of hand-rolling fetches:

```ts
import { createDebateClient } from "../backend/client";
const api = createDebateClient(process.env.NEXT_PUBLIC_INSFORGE_URL!);
const { room } = await api.createRoom({ topic_id: "nuclear-climate" });
const turn = await api.submitArgument({ room_id: room.id, round_no: 1, argument });
```

All request/response types live in `backend/client/types.ts` and mirror the contracts above.
